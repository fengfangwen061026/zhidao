import axios from 'axios';

const api = axios.create({ baseURL: '/api' });
const GENERATION_PREPARE_TIMEOUT_MS = 2 * 60 * 1000;
const GENERATION_SHEETS_TIMEOUT_MS = 6 * 60 * 1000;
const GENERATION_STORY_TIMEOUT_MS = 4 * 60 * 1000;

async function fetchWithTimeout(url, { timeoutMs = 30000, ...options } = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('请求超时，请重试');
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const isWrapped = (body) =>
  body && typeof body === 'object' && !Array.isArray(body) && 'code' in body && 'time' in body;

api.interceptors.response.use(
  (res) => {
    if (isWrapped(res.data)) {
      res.data = 'data' in res.data ? res.data.data : res.data;
    }
    return res;
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    // 402 / 扣点相关：让顶栏 CreditsPill 立即 refresh
    if (err.response?.status === 402) {
      try {
        window.dispatchEvent(new CustomEvent('app:credits-changed'));
      } catch {
        // ignore browsers without CustomEvent support
      }
    }
    const body = err.response?.data;
    if (isWrapped(body) && !('detail' in body)) {
      err.response.data = { ...body, detail: body.message };
    }
    return Promise.reject(err);
  }
);

export default api;

export function getApiErrorMessage(err, fallback = '请求失败') {
  if (!err?.response) return '无法连接服务器，请确认后端服务已启动';
  return err.response?.data?.detail || err.response?.data?.message || fallback;
}

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  submitOnboarding: (data) => api.post('/auth/onboarding', data),
};

export const userApi = {
  me: () => api.get('/users/me'),
  updateMe: (payload) => api.patch('/users/me', payload),
  uploadAvatar: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/users/me/avatar', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  changePassword: (payload) => api.post('/users/me/password', payload),
};

export const billingApi = {
  pricing: () => api.get('/billing/pricing'),
};

export const helpApi = {
  getDocument: () => api.get('/help/document'),
};

export const booksApi = {
  createBlank: () => api.post('/books/blank'),
  upload: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/books/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  list: () => api.get('/books'),
  get: (id) => api.get(`/books/${id}`),
  share: (id) => api.get(`/books/${id}/share`),
  delete: (id) => api.delete(`/books/${id}`),
  rename: (id, name) => api.patch(`/books/${id}/rename`, { name }),
  deletePage: (bookId, pageNum) => api.delete(`/books/${bookId}/pages/${pageNum}`),
  startVideoGeneration: (bookId, pageNum) =>
    api.post(`/books/${bookId}/pages/${pageNum}/video`),
  checkVideoStatus: (bookId, pageNum) =>
    api.get(`/books/${bookId}/pages/${pageNum}/video/status`),
  insertMediaPage: (bookId, { insertAfter, file, stepTitle, stepDescription } = {}) => {
    const fd = new FormData();
    fd.append('insert_after', String(insertAfter ?? 0));
    if (stepTitle) fd.append('step_title', stepTitle);
    if (stepDescription) fd.append('step_description', stepDescription);
    fd.append('file', file);
    return api.post(`/books/${bookId}/pages/media`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  insertMediaPageByUrl: (bookId, payload) =>
    api.post(`/books/${bookId}/pages/media/by-url`, payload),
  insertInteractivePage: (bookId, payload) =>
    api.post(`/books/${bookId}/pages/interactive`, payload),
  updateInteractivePage: (bookId, pageNum, payload) =>
    api.patch(`/books/${bookId}/pages/${pageNum}/interactive`, payload),
  aiEditInteractivePage: (bookId, pageNum, payload) =>
    api.post(`/books/${bookId}/pages/${pageNum}/interactive/ai-edit`, payload, {
      timeout: 300000,
    }),
  getRunningInteractive: (bookId) =>
    api.get(`/books/${bookId}/interactive/running-drafts`),
  exportCourse: (id) => api.get(`/books/${id}/export`),
};

// 互动网页 AI 对话：多轮上下文 + 版本时间线持久化 + 后台生成恢复
// - pageNum = 0 代表 insert 场景的 draft session。draftKey 是前端在抽屉打开时
//   生成的 uuid，用来让各次抽屉的 session 不互相污染。
// - send 只等后端 insert 完 pending row 就返回（通常 <1s），真正 LLM 跑在后台，
//   前端用 get 轮询 messages 看 progress_log / status。
function withDraftKey(params, draftKey) {
  if (!draftKey) return params || undefined;
  return { ...(params || {}), draft_key: draftKey };
}

export const interactiveChatApi = {
  get: (bookId, pageNum, opts = {}) => {
    const { draftKey, params, ...rest } = opts || {};
    return api.get(`/books/${bookId}/pages/${pageNum}/interactive/chat`, {
      ...rest,
      params: withDraftKey(params, draftKey),
    });
  },
  send: (bookId, pageNum, payload, opts = {}) => {
    const { draftKey, params, timeout, ...rest } = opts || {};
    return api.post(
      `/books/${bookId}/pages/${pageNum}/interactive/chat/message`,
      payload,
      {
        timeout: timeout ?? 20000,
        ...rest,
        params: withDraftKey(params, draftKey),
      }
    );
  },
  cancel: (bookId, pageNum, messageId, opts = {}) =>
    api.post(
      `/books/${bookId}/pages/${pageNum}/interactive/chat/message/${messageId}/cancel`,
      null,
      opts
    ),
  logEvent: (bookId, pageNum, payload, opts = {}) => {
    const { draftKey, params, ...rest } = opts || {};
    return api.post(
      `/books/${bookId}/pages/${pageNum}/interactive/chat/event`,
      payload,
      { ...rest, params: withDraftKey(params, draftKey) }
    );
  },
  reset: (bookId, pageNum, opts = {}) => {
    const { draftKey, params, ...rest } = opts || {};
    return api.delete(`/books/${bookId}/pages/${pageNum}/interactive/chat`, {
      ...rest,
      params: withDraftKey(params, draftKey),
    });
  },
  uploadAttachment: (bookId, pageNum, file, opts = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(
      `/books/${bookId}/pages/${pageNum}/interactive/chat/attachments`,
      fd,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
        ...opts,
      }
    );
  },
};

export const materialsApi = {
  list: () => api.get('/materials'),
  create: (payload) => api.post('/materials', payload),
  get: (id) => api.get(`/materials/${id}`),
  update: (id, payload) => api.patch(`/materials/${id}`, payload),
  aiEdit: (payload) => api.post('/materials/ai-edit', payload, { timeout: 300000 }),
  delete: (id) => api.delete(`/materials/${id}`),
};

export const mediaMaterialsApi = {
  list: (kind) => api.get('/media-materials', { params: { kind } }),
  upload: ({ file, title, description } = {}) => {
    const fd = new FormData();
    if (title) fd.append('title', title);
    if (description) fd.append('description', description);
    fd.append('file', file);
    return api.post('/media-materials', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  get: (id) => api.get(`/media-materials/${id}`),
  update: (id, payload) => api.patch(`/media-materials/${id}`, payload),
  delete: (id) => api.delete(`/media-materials/${id}`),
  generateImage: ({ prompt, reference_image_url, aspect_ratio } = {}) =>
    api.post(
      '/media-materials/ai/image',
      { prompt, reference_image_url, aspect_ratio },
      { timeout: 120000 },
    ),
  generateAudio: ({ text, voice_type, speed_ratio } = {}) =>
    api.post(
      '/media-materials/ai/audio',
      { text, voice_type, speed_ratio },
      { timeout: 120000 },
    ),
  saveFromUrl: (payload) => api.post('/media-materials/from-url', payload),
  listAiHistory: (kind, { limit = 60 } = {}) =>
    api.get('/media-materials/ai/history', { params: { kind, limit } }),
  deleteAiHistory: (id) => api.delete(`/media-materials/ai/history/${id}`),
};

export const plansApi = {
  list: (bookId) => api.get('/plans', { params: bookId ? { book_id: bookId } : {} }),
  get: (id) => api.get(`/plans/${id}`),
  toggleFavorite: (id) => api.post(`/plans/${id}/favorite`),
  favorites: () => api.get('/plans/favorites/list'),
  history: () => api.get('/plans/history/list'),
};

export function streamGenerate(bookId, token) {
  return fetch(`/api/plans/generate/${bookId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

export const voiceApi = {
  getScript: (bookId) => api.get(`/voice/script/${bookId}`),
  getCatalog: () => api.get('/voice/catalog'),
  updatePage: (bookId, pageNum, { text, voice_overrides } = {}) =>
    api.put(`/voice/script/${bookId}/page/${pageNum}`, { text, voice_overrides }),
};

export const charactersApi = {
  analyze: (bookId) => api.post(`/characters/${bookId}/analyze`, null, { timeout: 15000 }),
  get: (bookId) => api.get(`/characters/${bookId}`),
  cutout: (bookId) => api.post(`/characters/${bookId}/cutout`, null, { timeout: 15000 }),
  saveAvatar: (bookId, characterName, imageData) =>
    api.post(`/characters/${bookId}/avatar`, { character_name: characterName, image_data: imageData }),
  startChat: (bookId, characterName) =>
    api.post(`/characters/${bookId}/chat/start`, { character_name: characterName }, { timeout: 15000 }),
  sendMessage: (bookId, sessionId, message) =>
    api.post(`/characters/${bookId}/chat/message`, { session_id: sessionId, message }, { timeout: 30000 }),
  getGreetingAudio: (bookId, sessionId) =>
    api.get(`/characters/${bookId}/chat/${sessionId}/greeting-audio`),
  continueStory: (bookId, data) =>
    api.post(`/characters/${bookId}/continue-story`, data, { timeout: 15000 }),
};

export const generationApi = {
  getStyles: () => api.get('/generation/styles'),
  createTask: (data) => api.post('/generation/tasks', data),
  listTasks: () => api.get('/generation/tasks'),
  getTask: (id) => api.get(`/generation/tasks/${id}`),
  updateTask: (id, data) => api.patch(`/generation/tasks/${id}`, data),
  deleteTask: (id) => api.delete(`/generation/tasks/${id}`),
  generatePageImage: (taskId, pageNum, { aspectRatio } = {}) =>
    api.post(
      `/generation/tasks/${taskId}/pages/${pageNum}/generate-image`,
      aspectRatio ? { aspect_ratio: aspectRatio } : {},
    ),
  finalizeBook: (taskId) =>
    api.post(`/generation/tasks/${taskId}/finalize`),
};

export function streamPrepareTask(taskId, token, options = {}) {
  const suffix = options.regenerate ? '?regenerate=1' : '';
  return fetchWithTimeout(`/api/generation/tasks/${taskId}/prepare${suffix}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    timeoutMs: GENERATION_PREPARE_TIMEOUT_MS,
  });
}

export function streamGenerateSheets(taskId, token, options = {}) {
  const suffix = options.regenerate ? '?regenerate=1' : '';
  return fetchWithTimeout(`/api/generation/tasks/${taskId}/generate-sheets${suffix}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    timeoutMs: GENERATION_SHEETS_TIMEOUT_MS,
  });
}

export function streamGenerateStory(taskId, token, options = {}) {
  const suffix = options.regenerate ? '?regenerate=1' : '';
  return fetchWithTimeout(`/api/generation/tasks/${taskId}/generate-story${suffix}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    timeoutMs: GENERATION_STORY_TIMEOUT_MS,
  });
}

export function streamGenerateBook(taskId, token) {
  return fetch(`/api/generation/tasks/${taskId}/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function streamVoiceGenerate(bookId, token) {
  return fetch(`/api/voice/generate/${bookId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

export const activityPlansApi = {
  create: ({ prompt, mode = 'create', files = [] }) => {
    const fd = new FormData();
    fd.append('prompt', prompt || '');
    fd.append('mode', mode || 'create');
    (files || []).forEach((f) => {
      if (f) fd.append('files', f);
    });
    return api.post('/activity-plans', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  list: () => api.get('/activity-plans'),
  get: (id) => api.get(`/activity-plans/${id}`),
  delete: (id) => api.delete(`/activity-plans/${id}`),
  exportCourse: (id) => api.get(`/activity-plans/${id}/export`),
  // 新的多轮对话接口
  chatHistory: (id) => api.get(`/activity-plans/${id}/chat`),
  chatReset: (id) => api.post(`/activity-plans/${id}/chat/reset`),
};

export function streamActivityPlan(planId, token) {
  return fetch(`/api/activity-plans/${planId}/stream`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// 活动方案对话流式发送：multipart/form-data（text + files[]），SSE 流回。
// 支持传入 ``signal``：前端点"停止"时 abort 该请求，浏览器会断开 TCP，
// 后端 ``activity_plan_chat_controller`` 捕获 ``asyncio.CancelledError``
// 会关掉到千问/豆包的 httpx stream，不再继续消耗 token。
export function streamActivityPlanChat(
  planId,
  { text = '', files = [] } = {},
  token,
  { signal } = {},
) {
  const fd = new FormData();
  fd.append('text', text || '');
  (files || []).forEach((f) => {
    if (f) fd.append('files', f);
  });
  return fetch(`/api/activity-plans/${planId}/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
    signal,
  });
}

export const coursesApi = {
  import: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/courses/import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
