import axios from 'axios';

const http = axios.create({ baseURL: '/api' });

// Attach JWT to every request
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('ll_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle response errors globally
http.interceptors.response.use(
  (r) => r,
  (err) => {
    // Network error — backend is down / unreachable
    if (!err.response) {
      err.userMessage = 'Cannot reach the server. Make sure the backend is running on port 5000 and PostgreSQL is connected.';
      return Promise.reject(err);
    }

    const responseBody = err.response.data;
    if (err.response.status === 500
      && typeof responseBody === 'string'
      && /proxy error|econnrefused/i.test(responseBody)) {
      err.userMessage = 'The API is not running. Start PostgreSQL, set DATABASE_URL in the project .env file, then start the backend with "Set-Location server; npm run dev".';
      return Promise.reject(err);
    }

    // Auto-logout on 401 (expired/invalid token) but NOT on /auth routes
    if (err.response.status === 401 && !err.config.url.includes('/auth/')) {
      localStorage.removeItem('ll_token');
      localStorage.removeItem('ll_user');
      // Redirect only if we are not already on the login page
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }

    return Promise.reject(err);
  }
);

// Helper to extract error message from any axios error
export const getErrorMessage = (err) => {
  if (err.userMessage) return err.userMessage;
  if (!err.response)   return 'Cannot reach the server. Is the backend running?';
  if (typeof err.response.data === 'string') {
    return err.response.data || `Server error (${err.response.status})`;
  }
  return err.response.data?.error || `Server error (${err.response.status})`;
};

// ── Auth ──────────────────────────────────────────────────────────
export const register = (d) => http.post('/auth/register', d).then((r) => r.data);
export const login    = (d) => http.post('/auth/login',    d).then((r) => r.data);
export const getMe    = ()  => http.get('/auth/me').then((r) => r.data);

// ── Accounts ──────────────────────────────────────────────────────
export const fetchAccounts  = ()   => http.get('/accounts').then((r) => r.data);
export const createAccount  = (d)  => http.post('/accounts', d).then((r) => r.data);
export const fetchAccount   = (id) => http.get(`/accounts/${id}`).then((r) => r.data);
export const fetchBalance   = (id) => http.get(`/accounts/${id}/balance`).then((r) => r.data);
export const fetchStatement = (id) => http.get(`/accounts/${id}/statement`).then((r) => r.data);

// ── Ledger operations ─────────────────────────────────────────────
export const deposit  = (d) => http.post('/ledger/deposit',  d).then((r) => r.data);
export const withdraw = (d) => http.post('/ledger/withdraw', d).then((r) => r.data);
export const transfer = (d) => http.post('/ledger/transfer', d).then((r) => r.data);

// ── Transactions ──────────────────────────────────────────────────
export const createTransaction       = (d)  => http.post('/transactions', d).then((r) => r.data);
export const fetchTransactions       = ()   => http.get('/transactions').then((r) => r.data);
export const fetchTransactionEntries = (id) => http.get(`/transactions/${id}/entries`).then((r) => r.data);

// ── Audit ─────────────────────────────────────────────────────────
export const fetchAuditLogs = (params = {}) =>
  http.get('/audit', { params }).then((r) => r.data);
