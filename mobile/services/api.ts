// API base URL — points to the running FastAPI backend
export const API_BASE_URL = "http://localhost:8000/api/v1";
export const API_KEY = "fs_demo_key_001";

import axios from "axios";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
  },
  timeout: 10000,
});

// ── Analytics ──────────────────────────────────────────────
export const fetchAnalytics = async (period = "24h") => {
  const { data } = await api.get(`/analytics?period=${period}`);
  return data;
};

// ── Transactions list ──────────────────────────────────────
export const fetchTransactions = async (limit = 50) => {
  const { data } = await api.get(`/analytics?period=24h`);
  return data;
};

// ── Risk Detail ────────────────────────────────────────────
export const fetchRiskDetail = async (transactionId: string) => {
  const { data } = await api.get(`/risk/${transactionId}`);
  return data;
};

// ── Submit Feedback ────────────────────────────────────────
export const submitFeedback = async (payload: {
  transaction_id: string;
  feedback_type: string;
  analyst_decision: string;
  fraud_type?: string;
  notes?: string;
  escalate_to_case?: boolean;
}) => {
  const { data } = await api.post("/feedback", payload);
  return data;
};

// ── Model Status ───────────────────────────────────────────
export const fetchModelStatus = async () => {
  const { data } = await api.get("/model");
  return data;
};

// ── Health ─────────────────────────────────────────────────
export const fetchHealth = async () => {
  const { data } = await api.get("/health");
  return data;
};

// ── Score a transaction ────────────────────────────────────
export const scoreTransaction = async (payload: object) => {
  const { data } = await api.post("/score", payload);
  return data;
};

export default api;
