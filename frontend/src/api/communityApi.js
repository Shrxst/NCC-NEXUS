import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const client = axios.create({
  baseURL: `${API_BASE_URL}/api/community`,
  timeout: 120000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status || 500;
    const message = error?.response?.data?.message || error?.message || "Request failed";
    const wrapped = new Error(message);
    wrapped.status = status;
    wrapped.payload = error?.response?.data;
    throw wrapped;
  }
);

export const communityApi = {
  getFeed: () => client.get("/feed"),
  getModerationQueue: () => client.get("/moderation"),
  createPost: (payload, mediaFiles) => {
    const formData = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
        formData.append(key, JSON.stringify(value));
        return;
      }
      formData.append(key, String(value));
    });
    (mediaFiles?.images || []).forEach((file) => formData.append("images", file));
    (mediaFiles?.videos || []).forEach((file) => formData.append("videos", file));
    (mediaFiles?.pdfs || []).forEach((file) => formData.append("pdfs", file));
    return client.post("/post", formData);
  },
  updatePost: (postId, payload, mediaFiles) => {
    const formData = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
        formData.append(key, JSON.stringify(value));
        return;
      }
      formData.append(key, String(value));
    });
    (mediaFiles?.images || []).forEach((file) => formData.append("images", file));
    (mediaFiles?.videos || []).forEach((file) => formData.append("videos", file));
    (mediaFiles?.pdfs || []).forEach((file) => formData.append("pdfs", file));
    return client.patch(`/${encodeURIComponent(postId)}`, formData);
  },
  togglePin: (postId) => client.patch(`/${encodeURIComponent(postId)}/pin`),
  approvePost: (postId) => client.patch(`/${encodeURIComponent(postId)}/approve`),
  rejectPost: (postId, moderation_note) =>
    client.patch(`/${encodeURIComponent(postId)}/reject`, { moderation_note }),
  reactToPost: (postId, reaction_type) =>
    client.post(`/${encodeURIComponent(postId)}/react`, { reaction_type }),
  votePoll: (postId, option_id) =>
    client.post(`/${encodeURIComponent(postId)}/vote`, { option_id }),
  getComments: (postId) => client.get(`/${encodeURIComponent(postId)}/comments`),
  getMediaDownloadUrl: (mediaId) => client.get(`/media/${encodeURIComponent(mediaId)}/download-url`),
  addComment: (postId, payload) => client.post(`/${encodeURIComponent(postId)}/comment`, payload),
  deletePost: (postId) => client.delete(`/${encodeURIComponent(postId)}`),
};

export default communityApi;
