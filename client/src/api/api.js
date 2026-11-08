import axios from 'axios';

const http = axios.create({ baseURL: '/api' });

// Attach JWT to every request
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('ll_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ll_token');
      localStorage.removeItem('ll_user');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

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
export const fetchTransactions       = ()   => http.get('/transactions').then((r) => r.data);
export const fetchTransactionEntries = (id) => http.get(`/transactions/${id}/entries`).then((r) => r.data);

// ── Audit ─────────────────────────────────────────────────────────
export const fetchAuditLogs = (params = {}) =>
  http.get('/audit', { params }).then((r) => r.data);
