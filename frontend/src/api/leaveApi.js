import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const client = axios.create({
  baseURL: `${API_BASE_URL}/api/leave`,
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

export const leaveApi = {
  apply: (formData) =>
    client.post("/apply", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getMy: () => client.get("/my"),
  getAll: () => client.get("/all"),
  reviewStatus: (leaveId, payload) => client.patch(`/${encodeURIComponent(leaveId)}/status`, payload),
};

export default leaveApi;
