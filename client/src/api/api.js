import axios from 'axios';

const BASE = '/api';

// --- Accounts ---
export const fetchAccounts = () =>
  axios.get(`${BASE}/accounts`).then((r) => r.data);

export const createAccount = (data) =>
  axios.post(`${BASE}/accounts`, data).then((r) => r.data);

export const fetchBalance = (id) =>
  axios.get(`${BASE}/accounts/${id}/balance`).then((r) => r.data);

// --- Transactions ---
export const fetchTransactions = () =>
  axios.get(`${BASE}/transactions`).then((r) => r.data);

export const createTransaction = (data) =>
  axios.post(`${BASE}/transactions`, data).then((r) => r.data);

export const fetchTransactionEntries = (id) =>
  axios.get(`${BASE}/transactions/${id}/entries`).then((r) => r.data);
