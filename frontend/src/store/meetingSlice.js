import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { meetingApi } from "../api/meetingApi";

const STORAGE_KEY = "ncc_meetings";
const PARTICIPANTS_KEY = "ncc_meeting_participants";

const loadMeetings = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveMeetings = (meetings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
  } catch {}
};

const loadParticipants = () => {
  try {
    const raw = localStorage.getItem(PARTICIPANTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveParticipants = (participants) => {
  try {
    localStorage.setItem(PARTICIPANTS_KEY, JSON.stringify(participants));
  } catch {}
};

export const fetchMeetings = createAsyncThunk("meetings/fetchMeetings", async () => {
  try {
    const response = await meetingApi.listMeetings();
    return response.data || [];
  } catch {
    return loadMeetings();
  }
});

export const fetchMeetingById = createAsyncThunk(
  "meetings/fetchMeetingById",
  async (meetingId) => {
    const response = await meetingApi.getMeetingById(meetingId);
    return {
      meeting: response.data?.meeting || null,
      participants: response.data?.participants || [],
    };
  }
);

export const createMeetingAsync = createAsyncThunk(
  "meetings/createMeeting",
  async (payload) => {
    const response = await meetingApi.createMeeting(payload);
    return response.data;
  }
);

export const updateMeetingStatusAsync = createAsyncThunk(
  "meetings/updateMeetingStatus",
  async ({ meetingId, status }) => {
    const response = await meetingApi.updateMeetingStatus({ meetingId, status });
    return response.data;
  }
);

export const requestAdmissionAsync = createAsyncThunk(
  "meetings/requestAdmission",
  async ({ meetingId }) => {
    const response = await meetingApi.requestAdmission({ meetingId });
    return {
      meetingId: String(meetingId),
      payload: response.data || {},
    };
  }
);

export const joinMeetingAsync = createAsyncThunk(
  "meetings/joinMeeting",
  async ({ meetingId }) => {
    const response = await meetingApi.joinMeeting({ meetingId });
    return {
      meetingId: String(meetingId),
      payload: response.data || {},
    };
  }
);

export const leaveMeetingAsync = createAsyncThunk(
  "meetings/leaveMeeting",
  async ({ meetingId, userId }) => {
    await meetingApi.leaveMeeting({ meetingId });
    return {
      meetingId: String(meetingId),
      userId: Number(userId),
    };
  }
);

export const deleteMeetingAsync = createAsyncThunk(
  "meetings/deleteMeeting",
  async ({ meetingId }) => {
    await meetingApi.deleteMeeting({ meetingId });
    return {
      meetingId: String(meetingId),
    };
  }
);

export const fetchParticipants = createAsyncThunk(
  "meetings/fetchParticipants",
  async (meetingId) => {
    const response = await meetingApi.getParticipants(meetingId);
    return {
      meetingId: String(meetingId),
      participants: response.data || [],
    };
  }
);

export const fetchWaitingList = createAsyncThunk(
  "meetings/fetchWaitingList",
  async (meetingId) => {
    const response = await meetingApi.getWaitingList(meetingId);
    return {
      meetingId: String(meetingId),
      waiting: response.data || [],
    };
  }
);

export const admitUserAsync = createAsyncThunk(
  "meetings/admitUser",
  async ({ meetingId, waitingId }) => {
    const response = await meetingApi.admitUser({ meetingId, waitingId });
    return {
      meetingId: String(meetingId),
      waitingId: Number(waitingId),
      userId: Number(response.data?.userId || 0),
    };
  }
);

export const rejectUserAsync = createAsyncThunk(
  "meetings/rejectUser",
  async ({ meetingId, waitingId }) => {
    const response = await meetingApi.rejectUser({ meetingId, waitingId });
    return {
      meetingId: String(meetingId),
      waitingId: Number(waitingId),
      userId: Number(response.data?.userId || 0),
    };
  }
);

export const fetchMeetingReport = createAsyncThunk(
  "meetings/fetchMeetingReport",
  async (meetingId) => {
    const response = await meetingApi.getMeetingReport(meetingId);
    const payload = response.data || {};

    return {
      meetingId: String(meetingId),
      report: {
        summary: {
          totalInvited: Number(payload.report?.total_invited || 0),
          totalPresent: Number(payload.report?.total_present || 0),
          totalAbsent: Number(payload.report?.total_absent || 0),
          attendancePercent: Number(payload.report?.attendance_percentage || 0),
          lateCount: Number(payload.report?.late_count || 0),
          avgDuration: Number(payload.report?.average_duration_minutes || 0),
        },
        attendance: Array.isArray(payload.attendance)
          ? payload.attendance.map((row, index) => ({
              userId: Number(row.user_id || index + 1),
              name: row.full_name || "Unknown",
              role: row.rank_name || "Cadet",
              duration: Number(row.total_duration_minutes || 0),
              percentAttended: Number(row.percentage_attended || 0),
              status: row.attendance_status || "ABSENT",
              late: Boolean(row.was_late),
            }))
          : [],
      },
    };
  }
);

const initialState = {
  meetings: loadMeetings(),
  currentMeeting: null,
  participants: loadParticipants(),
  waitingRoom: {},
  admittedUsers: {},
  reports: {},
  briefingMode: {},
  connectionStatus: "DISCONNECTED",
  meetingStatus: "IDLE",
  loading: false,
  error: null,
};

const meetingsSlice = createSlice({
  name: "meetings",
  initialState,
  reducers: {
    editMeeting(state, action) {
      const { meetingId, updates } = action.payload || {};
      state.meetings = state.meetings.map((m) =>
        m.id === meetingId ? { ...m, ...updates } : m
      );
      saveMeetings(state.meetings);
    },

    deleteMeeting(state, action) {
      const { meetingId } = action.payload || {};
      state.meetings = state.meetings.filter((m) => m.id !== meetingId);
      delete state.participants[meetingId];
      delete state.waitingRoom[meetingId];
      delete state.admittedUsers[meetingId];
      delete state.reports[meetingId];
      saveMeetings(state.meetings);
      saveParticipants(state.participants);
    },

    updateMeetingStatus(state, action) {
      const { meetingId, status } = action.payload || {};
      state.meetings = state.meetings.map((m) =>
        m.id === String(meetingId) ? { ...m, status } : m
      );
      if (state.currentMeeting?.id === String(meetingId)) {
        state.currentMeeting = { ...state.currentMeeting, status };
      }
      state.meetingStatus = status || state.meetingStatus;
      saveMeetings(state.meetings);
    },

    requestAdmission(state, action) {
      const { meetingId, userId, name, role } = action.payload || {};
      const key = String(meetingId);
      const queue = state.waitingRoom[key] || [];
      const exists = queue.some((item) => Number(item.userId) === Number(userId));
      if (!exists) {
        queue.push({
          waitingId: Number(userId),
          userId: Number(userId),
          name: name || `User #${userId}`,
          role: role || "Cadet",
          requestedAt: new Date().toISOString(),
        });
      }
      state.waitingRoom[key] = queue;
    },

    setCurrentMeeting(state, action) {
      const { meetingId } = action.payload || {};
      state.currentMeeting =
        state.meetings.find((m) => m.id === String(meetingId)) || null;
    },

    setConnectionStatus(state, action) {
      state.connectionStatus = action.payload;
    },

    joinMeeting(state, action) {
      const { meetingId, userId, user = null } = action.payload;
      const key = String(meetingId);
      const list = state.participants[key] || [];
      const exists = list.some((p) => Number(p.userId) === Number(userId));

      if (!exists) {
        list.push({
          userId: Number(userId),
          joinedAt: new Date().toISOString(),
          leftAt: null,
          user,
        });
      }

      state.participants[key] = list;
      saveParticipants(state.participants);
    },

    leaveMeeting(state, action) {
      const { meetingId, userId } = action.payload;
      const key = String(meetingId);

      state.participants[key] = (state.participants[key] || []).filter(
        (p) => Number(p.userId) !== Number(userId)
      );

      saveParticipants(state.participants);
    },

    toggleBriefingMode(state, action) {
      const { meetingId } = action.payload;
      const key = String(meetingId);
      state.briefingMode[key] = !state.briefingMode[key];
    },
  },

  extraReducers: (builder) => {
    builder.addCase(fetchMeetings.fulfilled, (state, action) => {
      state.loading = false;
      state.meetings = action.payload || [];
      saveMeetings(state.meetings);
    });

    builder.addCase(fetchMeetingById.fulfilled, (state, action) => {
      state.loading = false;
      const meeting = action.payload?.meeting;
      const participants = action.payload?.participants || [];
      if (!meeting?.id) return;

      const idx = state.meetings.findIndex((m) => m.id === meeting.id);
      if (idx >= 0) state.meetings[idx] = meeting;
      else state.meetings.unshift(meeting);

      state.participants[meeting.id] = participants;
      saveMeetings(state.meetings);
      saveParticipants(state.participants);
    });

    builder.addCase(createMeetingAsync.fulfilled, (state, action) => {
      state.loading = false;
      const meeting = action.payload;
      if (meeting?.id) {
        state.meetings.unshift(meeting);
        saveMeetings(state.meetings);
      }
    });

    builder.addCase(updateMeetingStatusAsync.fulfilled, (state, action) => {
      state.loading = false;
      const meeting = action.payload;
      if (!meeting?.id) return;

      state.meetings = state.meetings.map((m) =>
        m.id === meeting.id ? meeting : m
      );
      if (state.currentMeeting?.id === meeting.id) {
        state.currentMeeting = meeting;
      }
      state.meetingStatus = meeting.status;
      saveMeetings(state.meetings);
    });

    builder.addCase(fetchParticipants.fulfilled, (state, action) => {
      state.loading = false;
      const { meetingId, participants } = action.payload;
      state.participants[meetingId] = participants || [];
      saveParticipants(state.participants);
    });

    builder.addCase(fetchWaitingList.fulfilled, (state, action) => {
      state.loading = false;
      const { meetingId, waiting } = action.payload;
      state.waitingRoom[meetingId] = (waiting || []).map((u) => ({
        waitingId: Number(u.waiting_id),
        userId: Number(u.user_id),
        name: u.full_name || "Unknown",
        role: u.rank_name || "Cadet",
        requestedAt: u.request_time,
      }));
    });

    builder.addCase(admitUserAsync.fulfilled, (state, action) => {
      state.loading = false;
      const { meetingId, waitingId, userId } = action.payload;
      state.waitingRoom[meetingId] =
        (state.waitingRoom[meetingId] || []).filter(
          (u) => Number(u.waitingId) !== Number(waitingId)
        );

      if (!state.admittedUsers[meetingId]) {
        state.admittedUsers[meetingId] = [];
      }
      if (userId > 0 && !state.admittedUsers[meetingId].includes(userId)) {
        state.admittedUsers[meetingId].push(userId);
      }
    });

    builder.addCase(rejectUserAsync.fulfilled, (state, action) => {
      state.loading = false;
      const { meetingId, waitingId } = action.payload;
      state.waitingRoom[meetingId] =
        (state.waitingRoom[meetingId] || []).filter(
          (u) => Number(u.waitingId) !== Number(waitingId)
        );
    });

    builder.addCase(fetchMeetingReport.fulfilled, (state, action) => {
      state.loading = false;
      const { meetingId, report } = action.payload;
      state.reports[meetingId] = report;
    });

    builder.addCase(requestAdmissionAsync.fulfilled, (state) => {
      state.loading = false;
    });

    builder.addCase(joinMeetingAsync.fulfilled, (state) => {
      state.loading = false;
    });

    builder.addCase(leaveMeetingAsync.fulfilled, (state, action) => {
      state.loading = false;
      const { meetingId, userId } = action.payload;
      state.participants[meetingId] = (state.participants[meetingId] || []).filter(
        (p) => Number(p.userId) !== Number(userId)
      );
      saveParticipants(state.participants);
    });

    builder.addCase(deleteMeetingAsync.fulfilled, (state, action) => {
      state.loading = false;
      const { meetingId } = action.payload;
      state.meetings = state.meetings.filter((m) => String(m.id) !== String(meetingId));
      delete state.participants[meetingId];
      delete state.waitingRoom[meetingId];
      delete state.admittedUsers[meetingId];
      delete state.reports[meetingId];
      if (state.currentMeeting?.id === String(meetingId)) {
        state.currentMeeting = null;
      }
      saveMeetings(state.meetings);
      saveParticipants(state.participants);
    });

    builder
      .addMatcher(
        (action) =>
          action.type.startsWith("meetings/") &&
          action.type.endsWith("/pending"),
        (state) => {
          state.loading = true;
          state.error = null;
        }
      )
      .addMatcher(
        (action) =>
          action.type.startsWith("meetings/") &&
          action.type.endsWith("/rejected"),
        (state, action) => {
          state.loading = false;
          state.error = action.error?.message || "Request failed";
        }
      );
  },
});

export const {
  editMeeting,
  deleteMeeting,
  updateMeetingStatus,
  requestAdmission,
  setCurrentMeeting,
  setConnectionStatus,
  joinMeeting,
  leaveMeeting,
  toggleBriefingMode,
} = meetingsSlice.actions;

export default meetingsSlice.reducer;
