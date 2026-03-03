import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { meetingApi } from "../api/meetingApi";

// ── LocalStorage fallback helpers ──
// Used when the backend is not yet available

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
  } catch {
    // storage full or unavailable — ignore
  }
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
  } catch {
    // ignore
  }
};

const generateId = () => `mtg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ── Async Thunks — try API first, fall back to localStorage ──

export const fetchMeetings = createAsyncThunk(
  "meetings/fetchMeetings",
  async () => {
    try {
      const response = await meetingApi.listMeetings();
      return { source: "api", meetings: response.data };
    } catch {
      return { source: "local", meetings: loadMeetings() };
    }
  }
);

export const fetchMeetingById = createAsyncThunk(
  "meetings/fetchMeetingById",
  async (meetingId) => {
    try {
      const response = await meetingApi.getMeetingById(meetingId);
      return { source: "api", meeting: response.data };
    } catch {
      const all = loadMeetings();
      const found = all.find((m) => m.id === String(meetingId));
      return { source: "local", meeting: found || null };
    }
  }
);

export const createMeetingAsync = createAsyncThunk(
  "meetings/createMeeting",
  async (payload) => {
    try {
      const response = await meetingApi.createMeeting(payload);
      return { source: "api", meeting: response.data };
    } catch {
      // Fallback: save to localStorage
      const meeting = {
        id: generateId(),
        title: payload.title || "",
        description: payload.description || "",
        dateTime: payload.dateTime || null,
        meetingType: payload.meetingType || "General",
        invitedUserIds: Array.isArray(payload.invitedUserIds) ? payload.invitedUserIds : [],
        createdBy: payload.createdBy || payload.invitedUserIds?.[0] || 0,
        status: "SCHEDULED",
        restricted: payload.restricted || false,
        createdAt: new Date().toISOString(),
      };
      const all = loadMeetings();
      all.unshift(meeting);
      saveMeetings(all);
      return { source: "local", meeting };
    }
  }
);

export const updateMeetingStatusAsync = createAsyncThunk(
  "meetings/updateMeetingStatus",
  async ({ meetingId, status }) => {
    try {
      const response = await meetingApi.updateMeetingStatus({ meetingId, status });
      return { source: "api", meeting: response.data };
    } catch {
      // Fallback: update in localStorage
      const all = loadMeetings();
      const idx = all.findIndex((m) => m.id === String(meetingId));
      if (idx >= 0) {
        all[idx] = { ...all[idx], status };
        if (status === "LIVE") all[idx].startedAt = new Date().toISOString();
        if (status === "ENDED") all[idx].endedAt = new Date().toISOString();
        saveMeetings(all);
        return { source: "local", meeting: all[idx] };
      }
      return { source: "local", meeting: { id: meetingId, status } };
    }
  }
);

export const joinMeetingAsync = createAsyncThunk(
  "meetings/joinMeeting",
  async ({ meetingId, userId }) => {
    try {
      const response = await meetingApi.joinMeeting({ meetingId });
      return { source: "api", meetingId, participant: response.data };
    } catch {
      const allP = loadParticipants();
      const list = allP[meetingId] || [];
      const exists = list.some((p) => Number(p.userId) === Number(userId));
      if (!exists) {
        list.push({ userId: Number(userId), joinedAt: new Date().toISOString(), micOn: true, cameraOn: true });
      }
      allP[meetingId] = list;
      saveParticipants(allP);
      return { source: "local", meetingId, participant: { userId: Number(userId), joinedAt: new Date().toISOString() } };
    }
  }
);

export const leaveMeetingAsync = createAsyncThunk(
  "meetings/leaveMeeting",
  async ({ meetingId, userId }) => {
    try {
      await meetingApi.leaveMeeting({ meetingId });
      return { source: "api", meetingId, participant: { userId: Number(userId) } };
    } catch {
      const allP = loadParticipants();
      allP[meetingId] = (allP[meetingId] || []).filter((p) => Number(p.userId) !== Number(userId));
      saveParticipants(allP);
      return { source: "local", meetingId, participant: { userId: Number(userId) } };
    }
  }
);

export const fetchParticipants = createAsyncThunk(
  "meetings/fetchParticipants",
  async (meetingId) => {
    try {
      const response = await meetingApi.getParticipants(meetingId);
      return { source: "api", meetingId, participants: response.data };
    } catch {
      const allP = loadParticipants();
      return { source: "local", meetingId, participants: allP[meetingId] || [] };
    }
  }
);

export const fetchMeetingReport = createAsyncThunk(
  "meetings/fetchMeetingReport",
  async (meetingId) => {
    try {
      const response = await meetingApi.getMeetingReport(meetingId);
      const report = response.data?.data || response.data;
      return { source: "api", meetingId, report };
    } catch {
      // Fallback: generate report from localStorage
      const allP = loadParticipants();
      const participants = allP[meetingId] || [];
      const all = loadMeetings();
      const meeting = all.find((m) => m.id === String(meetingId));
      const invited = meeting?.invitedUserIds || [];
      return {
        source: "local",
        meetingId,
        report: {
          totalInvited: invited.length,
          totalPresent: participants.length,
          totalAbsent: Math.max(0, invited.length - participants.length),
          attendancePercent: invited.length > 0 ? Math.round((participants.length / invited.length) * 100) : 0,
          participants,
        },
      };
    }
  }
);

// ── Slice ──

const initialState = {
  meetings: loadMeetings(),
  currentMeeting: null,
  participants: loadParticipants(),
  reports: {},
  isHost: false,
  meetingStatus: "IDLE",
  connectionStatus: "DISCONNECTED",
  loading: false,
  error: null,
  waitingRoom: {},
  admittedUsers: {},
  briefingMode: {},
};

const updateParticipant = (state, meetingId, userId, updater) => {
  const list = state.participants[meetingId] || [];
  state.participants[meetingId] = list.map((p) => {
    if (Number(p.userId) !== Number(userId)) return p;
    return updater(p);
  });
};

const persistMeetings = (state) => saveMeetings(state.meetings);
const persistParticipants = (state) => saveParticipants(state.participants);

const meetingsSlice = createSlice({
  name: "meetings",
  initialState,
  reducers: {
    addMeeting(state, action) {
      const meeting = action.payload;
      const exists = state.meetings.some((m) => m.id === meeting.id);
      if (!exists) {
        state.meetings.unshift(meeting);
        persistMeetings(state);
      }
    },
    editMeeting(state, action) {
      const { meetingId, updates } = action.payload;
      state.meetings = state.meetings.map((m) =>
        m.id === meetingId ? { ...m, ...updates } : m
      );
      if (state.currentMeeting?.id === meetingId) {
        state.currentMeeting = { ...state.currentMeeting, ...updates };
      }
      persistMeetings(state);
    },
    deleteMeeting(state, action) {
      const { meetingId } = action.payload;
      state.meetings = state.meetings.filter((m) => m.id !== meetingId);
      delete state.participants[meetingId];
      delete state.waitingRoom[meetingId];
      delete state.admittedUsers[meetingId];
      delete state.briefingMode[meetingId];
      persistMeetings(state);
      persistParticipants(state);
    },
    setCurrentMeeting(state, action) {
      const { meetingId, userId } = action.payload || {};
      const found = state.meetings.find((m) => m.id === meetingId) || null;
      state.currentMeeting = found;
      state.isHost = Boolean(found && Number(found.createdBy) === Number(userId));
      state.meetingStatus = found ? found.status : "IDLE";
    },
    updateMeetingStatus(state, action) {
      const { meetingId, status } = action.payload;
      state.meetings = state.meetings.map((m) =>
        m.id === meetingId ? { ...m, status } : m
      );
      if (state.currentMeeting?.id === meetingId) {
        state.currentMeeting = { ...state.currentMeeting, status };
      }
      state.meetingStatus = status;
      persistMeetings(state);
    },
    joinMeeting(state, action) {
      const { meetingId, userId } = action.payload;
      const list = state.participants[meetingId] || [];
      const exists = list.some((p) => Number(p.userId) === Number(userId));
      if (!exists) {
        list.push({ userId, micOn: true, cameraOn: true, joinedAt: new Date().toISOString() });
      }
      state.participants[meetingId] = list;
      state.connectionStatus = "CONNECTED";
      persistParticipants(state);
    },
    leaveMeeting(state, action) {
      const { meetingId, userId } = action.payload;
      state.participants[meetingId] = (state.participants[meetingId] || []).filter(
        (p) => Number(p.userId) !== Number(userId)
      );
      state.connectionStatus = "DISCONNECTED";
      persistParticipants(state);
    },
    toggleMic(state, action) {
      const { meetingId, userId } = action.payload;
      updateParticipant(state, meetingId, userId, (p) => ({ ...p, micOn: !p.micOn }));
    },
    toggleCamera(state, action) {
      const { meetingId, userId } = action.payload;
      updateParticipant(state, meetingId, userId, (p) => ({ ...p, cameraOn: !p.cameraOn }));
    },
    muteParticipant(state, action) {
      const { meetingId, userId } = action.payload;
      updateParticipant(state, meetingId, userId, (p) => ({ ...p, micOn: false }));
    },
    removeParticipant(state, action) {
      const { meetingId, userId } = action.payload;
      state.participants[meetingId] = (state.participants[meetingId] || []).filter(
        (p) => Number(p.userId) !== Number(userId)
      );
    },
    setConnectionStatus(state, action) {
      state.connectionStatus = action.payload;
    },
    requestAdmission(state, action) {
      const { meetingId, userId, name, role } = action.payload;
      const queue = state.waitingRoom[meetingId] || [];
      const exists = queue.some((r) => Number(r.userId) === Number(userId));
      if (!exists) {
        queue.push({ userId, name, role, requestedAt: new Date().toISOString() });
      }
      state.waitingRoom[meetingId] = queue;
    },
    admitUser(state, action) {
      const { meetingId, userId } = action.payload;
      state.waitingRoom[meetingId] = (state.waitingRoom[meetingId] || []).filter(
        (r) => Number(r.userId) !== Number(userId)
      );
      const admitted = state.admittedUsers[meetingId] || [];
      if (!admitted.includes(Number(userId))) {
        admitted.push(Number(userId));
      }
      state.admittedUsers[meetingId] = admitted;
    },
    rejectUser(state, action) {
      const { meetingId, userId } = action.payload;
      state.waitingRoom[meetingId] = (state.waitingRoom[meetingId] || []).filter(
        (r) => Number(r.userId) !== Number(userId)
      );
    },
    toggleBriefingMode(state, action) {
      const { meetingId } = action.payload;
      state.briefingMode[meetingId] = !state.briefingMode[meetingId];
    },
  },
  extraReducers: (builder) => {
    // fetchMeetings
    builder.addCase(fetchMeetings.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchMeetings.fulfilled, (state, action) => {
      state.loading = false;
      const { meetings, source } = action.payload;
      state.meetings = meetings;
      if (source === "api") persistMeetings(state);
    });
    builder.addCase(fetchMeetings.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // fetchMeetingById
    builder.addCase(fetchMeetingById.fulfilled, (state, action) => {
      const { meeting, source } = action.payload;
      if (!meeting) return;
      const idx = state.meetings.findIndex((m) => m.id === meeting.id);
      if (idx >= 0) {
        state.meetings[idx] = meeting;
      } else {
        state.meetings.push(meeting);
      }
      if (source === "api") persistMeetings(state);
    });

    // createMeetingAsync
    builder.addCase(createMeetingAsync.fulfilled, (state, action) => {
      const { meeting, source } = action.payload;
      const exists = state.meetings.some((m) => m.id === meeting.id);
      if (!exists) {
        state.meetings.unshift(meeting);
      }
      if (source === "api") persistMeetings(state);
    });

    // updateMeetingStatusAsync
    builder.addCase(updateMeetingStatusAsync.fulfilled, (state, action) => {
      const { meeting } = action.payload;
      state.meetings = state.meetings.map((m) =>
        m.id === meeting.id ? meeting : m
      );
      if (state.currentMeeting?.id === meeting.id) {
        state.currentMeeting = meeting;
      }
      state.meetingStatus = meeting.status;
      persistMeetings(state);
    });

    // joinMeetingAsync
    builder.addCase(joinMeetingAsync.fulfilled, (state, action) => {
      const { meetingId, participant } = action.payload;
      const list = state.participants[meetingId] || [];
      const exists = list.some((p) => Number(p.userId) === Number(participant.userId));
      if (!exists) {
        list.push(participant);
      }
      state.participants[meetingId] = list;
      state.connectionStatus = "CONNECTED";
    });

    // leaveMeetingAsync
    builder.addCase(leaveMeetingAsync.fulfilled, (state, action) => {
      const { meetingId, participant } = action.payload;
      state.participants[meetingId] = (state.participants[meetingId] || []).filter(
        (p) => Number(p.userId) !== Number(participant.userId)
      );
      state.connectionStatus = "DISCONNECTED";
    });

    // fetchParticipants
    builder.addCase(fetchParticipants.fulfilled, (state, action) => {
      const { meetingId, participants } = action.payload;
      state.participants[meetingId] = participants;
    });

    // fetchMeetingReport
    builder.addCase(fetchMeetingReport.fulfilled, (state, action) => {
      const { meetingId, report } = action.payload;
      state.reports[meetingId] = report;
    });
  },
});

export const {
  addMeeting,
  editMeeting,
  deleteMeeting,
  setCurrentMeeting,
  updateMeetingStatus,
  joinMeeting,
  leaveMeeting,
  toggleMic,
  toggleCamera,
  muteParticipant,
  removeParticipant,
  setConnectionStatus,
  requestAdmission,
  admitUser,
  rejectUser,
  toggleBriefingMode,
} = meetingsSlice.actions;

export default meetingsSlice.reducer;
