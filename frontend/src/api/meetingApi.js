import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const client = axios.create({
  baseURL: `${API_BASE_URL}/api/meetings`,
  timeout: 15000,
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
    const message =
      error?.response?.data?.message ||
      error?.message ||
      "Request failed";

    const wrapped = new Error(message);
    wrapped.status = status;
    wrapped.payload = error?.response?.data;
    throw wrapped;
  }
);

const toBackendMeetingType = (value = "") => String(value).trim().toLowerCase();
const toFrontendMeetingType = (value = "") => {
  const map = { general: "General", training: "Training", briefing: "Briefing" };
  return map[String(value).toLowerCase()] || "General";
};

const toBackendStatus = (value = "") => String(value).trim().toLowerCase();
const toFrontendStatus = (value = "") => String(value).trim().toUpperCase();

const mapMeetingToFrontend = (meeting = {}) => ({
  id: String(meeting.meeting_id),
  title: meeting.title || "",
  description: meeting.description || "",
  dateTime: meeting.scheduled_at || null,
  meetingType: toFrontendMeetingType(meeting.meeting_type),
  invitedUserIds: Array.isArray(meeting.invite_user_ids)
    ? meeting.invite_user_ids.map((id) => Number(id))
    : [],
  createdBy: Number(meeting.created_by_user_id),
  status: toFrontendStatus(meeting.status || "scheduled"),
  startedAt: meeting.started_at || null,
  endedAt: meeting.ended_at || null,
  collegeId: Number(meeting.college_id),
});

const mapParticipantToFrontend = (participant = {}) => ({
  participantId: Number(participant.participant_id),
  meetingId: String(participant.meeting_id),
  userId: Number(participant.user_id),
  joinedAt: participant.joined_at || null,
  leftAt: participant.left_at || null,
  roleAtJoin: participant.role_at_join || null,
  user: participant.user || null,
});

const normalizeCreatePayload = (payload = {}) => {
  const inviteUserIds = Array.isArray(payload.invitedUserIds)
    ? payload.invitedUserIds
    : Array.isArray(payload.invite_user_ids)
      ? payload.invite_user_ids
      : [];

  return {
    title: payload.title,
    description: payload.description || "",
    meeting_type: toBackendMeetingType(payload.meetingType || payload.meeting_type),
    scheduled_at: payload.dateTime || payload.scheduled_at,
    invite_user_ids: [...new Set(inviteUserIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))],
  };
};

export const meetingApi = {
  listMeetings: async ({ status } = {}) => {
    const params = {};
    if (status) params.status = toBackendStatus(status);
    const response = await client.get("/", { params });
    return {
      ...response,
      data: (response.data?.data || []).map(mapMeetingToFrontend),
    };
  },

  getMeetingById: async (meetingId) => {
    const response = await client.get(`/${meetingId}`);
    return {
      ...response,
      data: mapMeetingToFrontend(response.data?.data || {}),
    };
  },

  createMeeting: async (payload) => {
    const response = await client.post("/", normalizeCreatePayload(payload));
    return {
      ...response,
      data: mapMeetingToFrontend(response.data?.data || {}),
    };
  },

  updateMeeting: async () => {
    throw new Error("Meeting update endpoint is not available.");
  },

  updateMeetingStatus: async ({ meetingId, status }) => {
    const normalized = toBackendStatus(status);
    if (normalized === "live") {
      const response = await client.patch(`/${meetingId}/start`);
      return { ...response, data: mapMeetingToFrontend(response.data?.data || {}) };
    }
    if (normalized === "ended") {
      const response = await client.patch(`/${meetingId}/end`);
      return { ...response, data: mapMeetingToFrontend(response.data?.data || {}) };
    }
    if (normalized === "cancelled") {
      const response = await client.patch(`/${meetingId}/cancel`);
      return { ...response, data: mapMeetingToFrontend(response.data?.data || {}) };
    }
    throw new Error("Unsupported meeting status transition.");
  },

  joinMeeting: async ({ meetingId }) => {
    const response = await client.post(`/${meetingId}/join`);
    return {
      ...response,
      data: mapParticipantToFrontend(response.data?.data || {}),
    };
  },

  leaveMeeting: async ({ meetingId }) => {
    const response = await client.post(`/${meetingId}/leave`);
    return {
      ...response,
      data: mapParticipantToFrontend(response.data?.data || {}),
    };
  },

  getParticipants: async (meetingId) => {
    const response = await client.get(`/${meetingId}/participants`);
    return {
      ...response,
      data: (response.data?.data || []).map(mapParticipantToFrontend),
    };
  },

  requestAdmission: async ({ meetingId }) => {
    const response = await client.post(`/${meetingId}/request-admission`);
    return response;
  },

  admitUser: async ({ meetingId, userId }) => {
    const response = await client.post(`/${meetingId}/admit`, { user_id: userId });
    return response;
  },

  rejectUser: async ({ meetingId, userId }) => {
    const response = await client.post(`/${meetingId}/reject`, { user_id: userId });
    return response;
  },

  getMeetingReport: async (meetingId) => {
    const response = await client.get(`/${meetingId}/report`);
    return response;
  },

  toggleBriefingMode: async ({ meetingId, active }) => {
    const response = await client.patch(`/${meetingId}/briefing`, { active });
    return response;
  },
};

export default meetingApi;
