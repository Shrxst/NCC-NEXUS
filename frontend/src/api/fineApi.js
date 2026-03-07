import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const client = axios.create({
  baseURL: `${API_BASE_URL}/api/fines`,
  timeout: 20000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const fineApi = {
  getMy: (params = {}) => client.get("/my", { params }),
  getAll: (params = {}) => client.get("/", { params }),
  pay: (fineId, payload) =>
    client.post(`/${encodeURIComponent(fineId)}/pay`, payload, payload instanceof FormData ? {
      headers: { "Content-Type": "multipart/form-data" },
    } : undefined),
  verify: (fineId, payload) => client.patch(`/${encodeURIComponent(fineId)}/verify`, payload),
  report: (params = {}) =>
    client.get("/report", {
      params,
      responseType: params.format === "csv" ? "blob" : "json",
    }),
};

export default fineApi;
