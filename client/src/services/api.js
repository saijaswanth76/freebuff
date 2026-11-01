import axios from 'axios';

/**
 * Centralised API configuration.
 *
 * - `withCredentials` sends the httpOnly session cookie on every request.
 * - The base URL comes from VITE_API_BASE_URL (see client/.env.example).
 *   When it is empty the Vite dev proxy forwards /api to http://localhost:5000.
 * - A token returned by the login endpoint is kept IN MEMORY ONLY (never
 *   localStorage) and sent as an Authorization header. The cookie is the
 *   primary mechanism; the header exists so API tools / refresh-free setups work.
 */
const baseURL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20000,
});

/**
 * Per-request config: JSON by default (axios sets it automatically), switch to
 * multipart/form-data only when the payload actually contains a file upload.
 */
const withPayload = (data) =>
  data instanceof FormData
    ? { data, headers: { 'Content-Type': 'multipart/form-data' } }
    : { data };

let authToken = null;
export const setAuthToken = (token) => {
  authToken = token || null;
};
export const getAuthToken = () => authToken;

api.interceptors.request.use((config) => {
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
  return config;
});

/* Session-expiry handling: any 401 (other than a login attempt) tells the
   AuthContext to return the user to the login screen. */
const SESSION_EXPIRED_EVENT = 'cfds:session-expired';
export const onSessionExpired = (handler) => {
  window.addEventListener(SESSION_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const isLoginAttempt = /\/api\/auth\/(login|register|me)/.test(error.config?.url || '');
    if (status === 401 && !isLoginAttempt) {
      authToken = null;
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  }
);

/**
 * Resolves a relative image path (e.g. "/uploads/abc.jpg") to the backend origin.
 *
 * The backend stores imageUrl as a root-relative path, which would resolve
 * against the static host (Vercel) in production and 404. When
 * VITE_API_BASE_URL is set we prefix it so images load from the API origin.
 * Absolute http(s) URLs and empty values are returned unchanged, and in local
 * dev (empty base URL) the Vite proxy serves /uploads, so it stays relative.
 */
export const resolveImageUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (!baseURL) return url; // local dev: proxy handles /uploads
  return url.startsWith('/') ? `${baseURL}${url}` : `${baseURL}/${url}`;
};

/** Extracts a readable message (and optional field details) from an error. */
export const getApiErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  const data = error?.response?.data;
  if (data?.message) {
    if (data.details?.length) {
      return data.details.map((d) => d.message).join(' ');
    }
    return data.message;
  }
  if (error?.message === 'Network Error') return 'Cannot reach the server. Is the backend running?';
  if (error?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  return error?.message || fallback;
};

/* ----------------------------- API endpoints ----------------------------- */

const q = (params = {}) => ({ params });

export const authAPI = {
  register: (payload) => api.post('/api/auth/register', payload).then((r) => r.data),
  login: (payload) => api.post('/api/auth/login', payload).then((r) => r.data),
  logout: () => api.post('/api/auth/logout').then((r) => r.data),
  me: () => api.get('/api/auth/me').then((r) => r.data),
};

export const statsAPI = {
  public: () => api.get('/api/stats/public').then((r) => r.data),
  meta: () => api.get('/api/meta').then((r) => r.data),
};

export const donationsAPI = {
  list: (params) => api.get('/api/donations', q(params)).then((r) => r.data),
  get: (id) => api.get(`/api/donations/${id}`).then((r) => r.data),
  history: (id) => api.get(`/api/donations/${id}/history`).then((r) => r.data),
  my: (params) => api.get('/api/donations/my', q(params)).then((r) => r.data),
  create: (payload) => {
    const { data, headers } = withPayload(payload);
    return api.post('/api/donations', data, { headers }).then((r) => r.data);
  },
  update: (id, payload) => {
    const { data, headers } = withPayload(payload);
    return api.put(`/api/donations/${id}`, data, { headers }).then((r) => r.data);
  },
  cancel: (id, reason) => api.patch(`/api/donations/${id}/cancel`, { reason }).then((r) => r.data),
};

export const ngoAPI = {
  dashboard: () => api.get('/api/ngo/dashboard').then((r) => r.data),
  browse: (params) => api.get('/api/ngo/donations', q(params)).then((r) => r.data),
  accepted: (params) => api.get('/api/ngo/accepted-donations', q(params)).then((r) => r.data),
  accept: (id) => api.post(`/api/ngo/donations/${id}/accept`).then((r) => r.data),
  requestVolunteer: (id, payload) =>
    api.post(`/api/ngo/donations/${id}/request-volunteer`, payload).then((r) => r.data),
  releaseVolunteer: (id) => api.patch(`/api/ngo/donations/${id}/release-volunteer`).then((r) => r.data),
  confirmDistribution: (id, payload) =>
    api.patch(`/api/ngo/donations/${id}/confirm-distribution`, payload).then((r) => r.data),
};

export const volunteerAPI = {
  dashboard: () => api.get('/api/volunteer/dashboard').then((r) => r.data),
  tasks: (params) => api.get('/api/volunteer/tasks', q(params)).then((r) => r.data),
  myTasks: (params) => api.get('/api/volunteer/tasks/my', q(params)).then((r) => r.data),
  task: (id) => api.get(`/api/volunteer/tasks/${id}`).then((r) => r.data),
  acceptTask: (id) => api.post(`/api/volunteer/tasks/${id}/accept`).then((r) => r.data),
  collect: (id, notes) => api.patch(`/api/volunteer/tasks/${id}/collect`, { notes }).then((r) => r.data),
  deliver: (id, deliveryNotes) =>
    api.patch(`/api/volunteer/tasks/${id}/deliver`, { deliveryNotes }).then((r) => r.data),
};

export const adminAPI = {
  dashboard: () => api.get('/api/admin/dashboard').then((r) => r.data),
  users: (params) => api.get('/api/admin/users', q(params)).then((r) => r.data),
  setUserStatus: (id, isActive) =>
    api.patch(`/api/admin/users/${id}/status`, { isActive }).then((r) => r.data),
  verifyNgo: (id, payload) => api.patch(`/api/admin/ngos/${id}/verify`, payload).then((r) => r.data),
  donations: (params) => api.get('/api/admin/donations', q(params)).then((r) => r.data),
  reports: (params) => api.get('/api/admin/reports', q(params)).then((r) => r.data),
};

export const notificationsAPI = {
  list: (params) => api.get('/api/notifications', q(params)).then((r) => r.data),
  markRead: (id) => api.patch(`/api/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.patch('/api/notifications/read-all').then((r) => r.data),
};
