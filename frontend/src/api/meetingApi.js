import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const normalizeMeetingId = (meetingId) =>
  String(meetingId ?? "")
    .trim()
    .replace(/^:/, "");

const toIsoIfLocalDateTime = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return raw;

  // datetime-local values do not include timezone, convert explicitly to ISO.
  const hasTimezone = /([zZ]|[+\-]\d{2}:?\d{2})$/.test(raw);
  if (hasTimezone) return raw;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toISOString();
};

const client = axios.create({
  baseURL: `${API_BASE_URL}/api/meetings`,
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

const toFrontendStatus = (value = "") => {
  const status = String(value).toUpperCase();
  if (status === "COMPLETED") return "ENDED";
  return status || "SCHEDULED";
};

const normalizeMeetingCreatorRole = (role = "", rank = "") => {
  const normalizedRole = String(role || "").toUpperCase();
  const normalizedRank = String(rank || "").trim().toLowerCase();

  if (normalizedRole === "ANO") return "ANO";
  if (normalizedRole === "CADET" && normalizedRank === "senior under officer") {
    return "SUO";
  }

  return normalizedRole || "CADET";
};

const mapMeetingToFrontend = (meeting = {}) => ({
  id: String(meeting.meeting_id || ""),
  title: meeting.title || "",
  description: meeting.description || "",
  dateTime: meeting.scheduled_at || null,
  meetingType: meeting.meeting_type || "General",
  invitedUserIds: Array.isArray(meeting.invite_user_ids)
    ? meeting.invite_user_ids.map((id) => Number(id))
    : [],
  createdBy: Number(meeting.created_by_user_id || 0),
  createdByName: meeting.created_by_name || "",
  createdByRole: meeting.created_by_role || "",
  createdByRank: meeting.created_by_rank || "",
  createdByAuthorityRole: normalizeMeetingCreatorRole(
    meeting.created_by_role,
    meeting.created_by_rank
  ),
  status: toFrontendStatus(meeting.status),
  startedAt: meeting.actual_start_time || null,
  endedAt: meeting.actual_end_time || null,
  collegeId: Number(meeting.college_id || 0),
  jitsi_room_name: meeting.jitsi_room_name || "",
});

const mapParticipantToFrontend = (participant = {}) => ({
  sessionId: Number(participant.session_id || 0),
  meetingId: String(participant.meeting_id || ""),
  userId: Number(participant.user_id || 0),
  joinedAt: participant.join_time || null,
  leftAt: participant.leave_time || null,
  user: {
    name: participant.full_name || `User #${participant.user_id}`,
    role: participant.role_label || participant.role || "CADET",
  },
});

const flattenMeetingBuckets = (payload = {}) => {
  const ongoing = Array.isArray(payload.ongoing) ? payload.ongoing : [];
  const upcoming = Array.isArray(payload.upcoming) ? payload.upcoming : [];
  const past = Array.isArray(payload.past) ? payload.past : [];
  return [...ongoing, ...upcoming, ...past].map(mapMeetingToFrontend);
};

export const meetingApi = {
  listMeetings: async () => {
    const response = await client.get("/");
    return {
      ...response,
      data: flattenMeetingBuckets(response.data || {}),
    };
  },

  getMeetingById: async (meetingId) => {
    const id = normalizeMeetingId(meetingId);
    const response = await client.get(`/${id}`);
    return {
      ...response,
      data: {
        meeting: mapMeetingToFrontend(response.data?.meeting || {}),
        participants: Array.isArray(response.data?.participants)
          ? response.data.participants.map(mapParticipantToFrontend)
          : [],
      },
    };
  },

  createMeeting: async (payload) => {
    const inviteUserIds = Array.isArray(payload?.invitedUserIds)
      ? payload.invitedUserIds
      : [];
    const scheduledAt = toIsoIfLocalDateTime(
      payload?.dateTime || payload?.scheduled_at
    );

    const response = await client.post("/", {
      title: payload?.title,
      description: payload?.description || "",
      scheduled_at: scheduledAt,
      invite_user_ids: [...new Set(inviteUserIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))],
    });

    return {
      ...response,
      data: mapMeetingToFrontend(response.data?.meeting || {}),
    };
  },

  updateMeetingStatus: async ({ meetingId, status }) => {
    const id = normalizeMeetingId(meetingId);
    const normalized = String(status || "").toUpperCase();

    if (normalized === "LIVE") {
      const response = await client.patch(`/${id}/start`);
      return {
        ...response,
        data: mapMeetingToFrontend(response.data?.meeting || {}),
      };
    }

    if (normalized === "ENDED" || normalized === "COMPLETED") {
      const response = await client.patch(`/${id}/end`);
      return {
        ...response,
        data: mapMeetingToFrontend(response.data?.meeting || {}),
      };
    }

    throw new Error("Unsupported meeting status transition.");
  },

  joinMeeting: async ({ meetingId }) => {
    const id = normalizeMeetingId(meetingId);
    const response = await client.post(`/${id}/join`);
    return {
      ...response,
      data: response.data || {},
    };
  },

  leaveMeeting: async ({ meetingId }) => {
    const id = normalizeMeetingId(meetingId);
    const response = await client.patch(`/${id}/leave`);
    return {
      ...response,
      data: response.data || {},
    };
  },

  deleteMeeting: async ({ meetingId }) => {
    const id = normalizeMeetingId(meetingId);
    const response = await client.delete(`/${id}`);
    return {
      ...response,
      data: {
        meeting: mapMeetingToFrontend(response.data?.meeting || {}),
        message: response.data?.message || "Meeting deleted successfully",
      },
    };
  },

  getWaitingList: async (meetingId) => {
    const id = normalizeMeetingId(meetingId);
    const response = await client.get(`/${id}/waiting`);
    return {
      ...response,
      data: response.data?.waiting || [],
    };
  },

  getParticipants: async (meetingId) => {
    const id = normalizeMeetingId(meetingId);
    const response = await client.get(`/${id}`);
    return {
      ...response,
      data: Array.isArray(response.data?.participants)
        ? response.data.participants.map(mapParticipantToFrontend)
        : [],
    };
  },

  getJitsiToken: async (meetingId) => {
    const id = normalizeMeetingId(meetingId);
    const response = await client.get(`/${id}/jitsi-token`);
    return {
      ...response,
      data: response.data || {},
    };
  },

  requestAdmission: async ({ meetingId }) => {
    const id = normalizeMeetingId(meetingId);
    const response = await client.post(`/${id}/join`);
    return response;
  },

  admitUser: async ({ meetingId, waitingId }) => {
    const id = normalizeMeetingId(meetingId);
    const response = await client.patch(`/${id}/admit/${waitingId}`);
    return response;
  },

  rejectUser: async ({ meetingId, waitingId }) => {
    const id = normalizeMeetingId(meetingId);
    const response = await client.patch(`/${id}/reject/${waitingId}`);
    return response;
  },

  getMeetingReport: async (meetingId) => {
    const id = normalizeMeetingId(meetingId);
    const response = await client.get(`/${id}/report`);
    return response;
  },
};

export default meetingApi;
