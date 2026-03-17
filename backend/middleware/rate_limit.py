"""
IP-based rate limiting middleware for LLM-calling endpoints.
Limits expensive API calls to prevent credit abuse.
"""

import time
from collections import defaultdict

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

# LLM을 호출하는 비싼 엔드포인트 (POST만 해당)
_RATE_LIMITED_PREFIXES = (
    "/api/risk/demo",
    "/api/risk/ontology",
    "/api/risk/compliance",
    "/api/risk/meeting",
    "/api/risk/playbook",
    "/api/agent/simulate",
    "/api/youtube/analyze",
    "/api/studio/upload",
    "/api/compliance/check",
    "/api/data/demo",
    "/api/data/amazon",
    "/api/discovery/search",
)

# IP당 하루 최대 호출 횟수
MAX_CALLS_PER_DAY = 30

# {ip: [(timestamp, path), ...]}
_call_log: dict[str, list[tuple[float, str]]] = defaultdict(list)


def _cleanup_old_entries(ip: str) -> None:
    """24시간 지난 기록 제거"""
    cutoff = time.time() - 86400
    _call_log[ip] = [(ts, p) for ts, p in _call_log[ip] if ts > cutoff]


def _get_client_ip(request: Request) -> str:
    """프록시 뒤에서도 실제 IP 추출"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        # POST 요청만 제한
        if request.method != "POST":
            return await call_next(request)

        # rate limit 대상 엔드포인트인지 확인
        path = request.url.path
        if not any(path.startswith(prefix) for prefix in _RATE_LIMITED_PREFIXES):
            return await call_next(request)

        ip = _get_client_ip(request)
        _cleanup_old_entries(ip)

        if len(_call_log[ip]) >= MAX_CALLS_PER_DAY:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Rate limit exceeded. Maximum {MAX_CALLS_PER_DAY} analysis requests per day.",
                    "retry_after": "24h",
                },
            )

        # 호출 기록 추가
        _call_log[ip].append((time.time(), path))
        remaining = MAX_CALLS_PER_DAY - len(_call_log[ip])

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(MAX_CALLS_PER_DAY)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
