"""
LLM API 호출 공통 유틸리티
LLM_PROVIDER=bedrock → AWS Nova 우선, OpenAI 폴백 (해커톤 제출)
LLM_PROVIDER=google  → Gemini 우선, 429시 backoff 재시도 후 OpenAI 폴백 (로컬 개발)
LLM_PROVIDER=openai  → OpenAI 우선, Gemini 폴백 (배포 환경)
"""

import json
import logging
import time

# pylint: disable=no-name-in-module
from google import genai
from google.genai import types
from google.genai.errors import ClientError as GeminiClientError

# pylint: enable=no-name-in-module
from openai import OpenAI

from core import config

logger = logging.getLogger(__name__)

# Gemini 429 재시도 설정
_GEMINI_RETRY_DELAYS = [10, 30]  # 1차: 10초 대기, 2차: 30초 대기 후 OpenAI 폴백

_openai_client = None  # pylint: disable=invalid-name
_gemini_client = None  # pylint: disable=invalid-name
_bedrock_client = None  # pylint: disable=invalid-name


def get_client():
    """OpenAI 클라이언트 반환. OPENAI_API_KEY 미설정 시 None 반환 (Gemini 모드 지원)."""
    global _openai_client  # pylint: disable=global-statement
    if _openai_client is None:
        if not config.OPENAI_API_KEY:
            logger.warning("OPENAI_API_KEY가 설정되지 않아 OpenAI 클라이언트를 초기화할 수 없습니다.")
            return None
        _openai_client = OpenAI(api_key=config.OPENAI_API_KEY)
    return _openai_client


def _get_gemini_client():
    """Gemini 클라이언트 반환"""
    global _gemini_client  # pylint: disable=global-statement
    if _gemini_client is None:
        if not config.GOOGLE_API_KEY:
            raise RuntimeError("GOOGLE_API_KEY가 설정되지 않았습니다.")
        _gemini_client = genai.Client(api_key=config.GOOGLE_API_KEY)
    return _gemini_client


def _get_bedrock_client():
    """AWS Bedrock Runtime 클라이언트 반환"""
    global _bedrock_client  # pylint: disable=global-statement
    if _bedrock_client is None:
        import boto3  # pylint: disable=import-outside-toplevel

        if not config.AWS_ACCESS_KEY_ID or not config.AWS_SECRET_ACCESS_KEY:
            raise RuntimeError("AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY가 설정되지 않았습니다.")
        _bedrock_client = boto3.client(
            "bedrock-runtime",
            region_name=config.AWS_DEFAULT_REGION,
            aws_access_key_id=config.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=config.AWS_SECRET_ACCESS_KEY,
        )
    return _bedrock_client


def _call_openai(client, prompt, system_prompt, model, temperature):
    """OpenAI API 호출"""
    if client is None:
        raise RuntimeError("OpenAI 클라이언트 없음 (OPENAI_API_KEY 미설정)")
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        temperature=temperature,
        response_format={"type": "json_object"},
    )
    return response.choices[0].message.content


def _call_gemini(prompt, system_prompt, temperature):
    """Gemini API 호출"""
    fallback = _get_gemini_client()
    response = fallback.models.generate_content(
        model=config.FALLBACK_LLM_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=temperature,
            response_mime_type="application/json",
        ),
    )
    return response.text


def _call_bedrock(prompt, system_prompt, temperature):
    """AWS Bedrock (Amazon Nova) API 호출"""
    client = _get_bedrock_client()

    body = {
        "messages": [
            {"role": "user", "content": [{"text": prompt}]},
        ],
        "system": [{"text": system_prompt}],
        "inferenceConfig": {
            "temperature": temperature,
            "maxTokens": 2048,
        },
    }

    response = client.invoke_model(
        modelId=config.BEDROCK_MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(body),
    )

    response_body = json.loads(response["body"].read())
    text = response_body["output"]["message"]["content"][0]["text"]
    # Nova가 ```json ... ``` 마크다운으로 감싸는 경우 제거
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # 첫 줄(```json)과 마지막 줄(```) 제거
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def call_openai_json(
    client,
    prompt,
    system_prompt="You are an expert at analyzing e-commerce customer feedback.",
    model=None,
    temperature=None,
):
    """
    LLM API를 호출하여 JSON 응답을 반환.
    LLM_PROVIDER 환경변수에 따라 primary/fallback 순서가 바뀜:
      - "bedrock" : AWS Nova 우선 → OpenAI 폴백  (해커톤 제출)
      - "google"  : Gemini 우선 → OpenAI 폴백    (로컬 개발)
      - "openai"  : OpenAI 우선 → Gemini 폴백    (배포, 기본값)
    """
    if model is None:
        model = config.LLM_MODEL
    if temperature is None:
        temperature = config.LLM_TEMPERATURE

    # JSON 출력을 강제하기 위해 system prompt에 지시 추가
    json_system_prompt = system_prompt
    if config.LLM_PROVIDER == "bedrock":
        json_system_prompt = system_prompt + "\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no explanation, just pure JSON."

    if config.LLM_PROVIDER == "bedrock":
        try:
            return _call_bedrock(prompt, json_system_prompt, temperature)
        except Exception as e:  # pylint: disable=broad-except
            logger.warning("Bedrock(Nova) 호출 실패, OpenAI 폴백 시도: %s", e)
            if client is None:
                logger.warning("OpenAI 폴백 불가, Gemini 폴백 시도")
                return _call_gemini(prompt, system_prompt, temperature)
            return _call_openai(client, prompt, system_prompt, model, temperature)

    if config.LLM_PROVIDER == "google":
        # 429 시 backoff 재시도 → 최종 실패 시 OpenAI 폴백
        last_exc = None
        for attempt, delay in enumerate([0, *_GEMINI_RETRY_DELAYS]):
            if delay:
                logger.warning("Gemini 429 — %d초 대기 후 재시도 (attempt %d)", delay, attempt + 1)
                time.sleep(delay)
            try:
                return _call_gemini(prompt, system_prompt, temperature)
            except GeminiClientError as e:
                if getattr(e, "status_code", None) == 429:
                    last_exc = e
                    continue  # 재시도
                break  # 429 외 에러는 바로 OpenAI 폴백
            except Exception as e:  # pylint: disable=broad-except
                last_exc = e
                break  # 비 429 예외는 바로 OpenAI 폴백

        logger.warning("Gemini 재시도 소진, OpenAI 폴백 (last_exc=%s)", last_exc)
        if client is None:
            raise RuntimeError(
                "Gemini 실패 후 OpenAI 폴백 불가: OPENAI_API_KEY 미설정"
            ) from last_exc
        return _call_openai(client, prompt, system_prompt, model, temperature)

    try:
        return _call_openai(client, prompt, system_prompt, model, temperature)
    except Exception:  # pylint: disable=broad-except
        logger.warning("OpenAI 호출 실패, Gemini 폴백 시도", exc_info=True)
        return _call_gemini(prompt, system_prompt, temperature)
