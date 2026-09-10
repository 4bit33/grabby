// Pure queue helpers — no React/Electron, fully testable (H4).

export const QUEUE_STORAGE_KEY = 'grabby_queue_v1';
export const QUEUE_MAX_ITEMS = 200;
export const QUEUE_OUTPUT_MAX = 2000;

export function makeQueueId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  try {
    // Node fallback (jest)
    // eslint-disable-next-line global-require
    const nodeCrypto = require('crypto');
    if (nodeCrypto?.randomUUID) return nodeCrypto.randomUUID();
  } catch {}
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function truncateQueueOutput(s, max = QUEUE_OUTPUT_MAX) {
  const str = String(s || '');
  if (str.length <= max) return str;
  return str.slice(-max);
}

export function createQueueItem(url) {
  return {
    id: makeQueueId(),
    url: String(url || '').trim(),
    status: 'pending',
    progress: 0,
    size: null,
    speed: null,
    eta: null,
    output: '',
    errorTitle: null,
    addedAt: Date.now(),
  };
}

const VALID_STATUS = new Set(['pending', 'downloading', 'completed', 'error']);

export function sanitizeQueueItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const url = String(raw.url || '').trim();
  if (!url) return null;
  let status = VALID_STATUS.has(raw.status) ? raw.status : 'pending';
  // A relaunch can never resume a mid-flight download — reset to pending.
  if (status === 'downloading') status = 'pending';
  const progress = Number.isFinite(Number(raw.progress)) ? Math.min(100, Math.max(0, Number(raw.progress))) : 0;
  return {
    id: String(raw.id || makeQueueId()),
    url,
    status,
    progress: status === 'completed' ? 100 : status === 'pending' ? 0 : progress,
    size: raw.size ?? null,
    speed: raw.speed ?? null,
    eta: raw.eta ?? null,
    output: truncateQueueOutput(raw.output || ''),
    errorTitle: raw.errorTitle ? String(raw.errorTitle).slice(0, 200) : null,
    addedAt: Number.isFinite(Number(raw.addedAt)) ? Number(raw.addedAt) : Date.now(),
  };
}

export function loadQueueFromJson(json) {
  try {
    if (!json) return [];
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeQueueItem)
      .filter(Boolean)
      .slice(0, QUEUE_MAX_ITEMS);
  } catch {
    return [];
  }
}

export function serializeQueue(queue) {
  try {
    const arr = (Array.isArray(queue) ? queue : []).slice(0, QUEUE_MAX_ITEMS).map((q) => ({
      ...q,
      output: truncateQueueOutput(q.output || ''),
    }));
    return JSON.stringify(arr);
  } catch {
    return '[]';
  }
}
