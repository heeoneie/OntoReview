import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 120000,
});

export const uploadCSV = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/data/upload', formData);
};

export const fetchSampleData = () => api.get('/data/sample');
export const runAnalysis = () => api.post('/analysis/run');
export const getExperimentResults = () => api.get('/analysis/experiment-results');

// 크롤링 API
export const crawlReviews = (url, maxPages = 50) =>
  api.post('/data/crawl', { url, max_pages: maxPages });

// 설정 API
export const getSettings = () => api.get('/data/settings');
export const updateSettings = (ratingThreshold) =>
  api.post('/data/settings', { rating_threshold: ratingThreshold });

// 리뷰 목록 API
export const getReviews = (page = 1, pageSize = 20) =>
  api.get('/data/reviews', { params: { page, page_size: pageSize } });

// 우선순위 리뷰 API
export const getPrioritizedReviews = (page = 1, pageSize = 20, level = null) =>
  api.get('/data/reviews/prioritized', {
    params: { page, page_size: pageSize, ...(level && { level }) },
  });

// 답변 생성 API
export const generateReply = (reviewText, rating, category = null) =>
  api.post('/reply/generate', { review_text: reviewText, rating, category });

export const generateBatchReplies = (reviews) =>
  api.post('/reply/generate-batch', { reviews });

// 답변 가이드 API
export const getReplyGuide = (category) =>
  api.post('/reply/guide', { category });

export const getAllGuides = () => api.get('/reply/guides');

// 리스크 인텔리전스 API
export const generateOntology = (analysisData) => api.post('/risk/ontology', analysisData);
export const generateComplianceReport = (analysisData) => api.post('/risk/compliance', analysisData);
export const generateMeetingAgenda = (analysisData) => api.post('/risk/meeting', analysisData);
export const runDemoScenario = (industry = 'ecommerce', lang = 'ko') =>
  api.post('/risk/demo', null, { params: { industry, lang }, timeout: 180000 });

// 플레이북 API
export const generatePlaybook = (body, config = {}) =>
  api.post('/risk/playbook/generate', body, config);

// KPI & Amazon pipeline
export const getKpiSummary = () => api.get('/kpi/summary');
export const getRiskTimeline = (limit = 20) =>
  api.get('/kpi/timeline', { params: { limit } });
export const ingestAmazon = (url) => api.post('/data/amazon', { url });
export const runFullDemo = () => api.post('/data/demo', null, { timeout: 180000 });
export const getOntologyGraph = (minSeverity = 0) =>
  api.get('/risk/ontology/graph', { params: { min_severity: minSeverity } });

// Audit trail
export const getAuditEvents = (limit = 50) =>
  api.get('/audit/events', { params: { limit } });

// AI 모델 평가 API
export const getEvaluationMetrics = () => api.get('/evaluate/metrics');
export const getDatasetInfo = () => api.get('/evaluate/dataset/info');

// Web Discovery API
export const searchBrandRisks = (brand, product) =>
  api.post('/discovery/search', { brand, product });

// Agent Communication Setup API
export const getAgentConfigs = () => api.get('/agent/configs');
export const updateAgentConfig = (agentType, config) =>
  api.put(`/agent/configs/${agentType}`, config);
export const simulateAgent = (body) =>
  api.post('/agent/simulate', body);

// Domain Ontology Studio API
export const uploadDomainKnowledge = (formData) =>
  api.post('/studio/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const getCustomRules = () => api.get('/studio/rules');
export const addCustomRule = (rule) =>
  api.post('/studio/rules', rule);
export const deleteCustomRule = (ruleId) =>
  api.delete(`/studio/rules/${ruleId}`);

// Global Compliance Tracker API
export const getRegulations = (jurisdiction) =>
  api.get('/compliance/regulations', { params: jurisdiction ? { jurisdiction } : {} });
export const runComplianceCheck = (body) =>
  api.post('/compliance/check', body);
export const getComplianceSummary = () => api.get('/compliance/summary');

// YouTube 실데이터 분석 API
export const analyzeYouTube = (query, brand, options = {}) =>
  api.post('/youtube/analyze', {
    query,
    brand,
    industry: options.industry || 'ecommerce',
    lang: options.lang || 'ko',
    max_videos: options.maxVideos || 3,
    max_comments_per_video: options.maxComments || 15,
  });
