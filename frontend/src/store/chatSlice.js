import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  entries: [],
  activeEntryId: null,
  messagesByRoom: {},
  typingByRoom: {},
  loading: false,
  error: null,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setChatLoading(state, action) {
      state.loading = Boolean(action.payload);
    },
    setChatError(state, action) {
      state.error = action.payload || null;
    },
    setChatEntries(state, action) {
      state.entries = Array.isArray(action.payload) ? action.payload : [];
    },
    setActiveEntryId(state, action) {
      state.activeEntryId = action.payload || null;
    },
    setRoomMessages(state, action) {
      const { roomId, messages } = action.payload || {};
      if (!roomId) return;
      state.messagesByRoom[roomId] = Array.isArray(messages) ? messages : [];
    },
    upsertRoomMessage(state, action) {
      const message = action.payload;
      const roomId = Number(message?.room_id || 0);
      if (!roomId) return;

      const current = Array.isArray(state.messagesByRoom[roomId]) ? state.messagesByRoom[roomId] : [];
      const map = new Map(current.map((item) => [Number(item.message_id), item]));
      map.set(Number(message.message_id), message);
      state.messagesByRoom[roomId] = [...map.values()].sort((a, b) => Number(a.message_id) - Number(b.message_id));
    },
    removeRoomMessage(state, action) {
      const { roomId, messageId } = action.payload || {};
      if (!roomId || !messageId) return;
      const current = Array.isArray(state.messagesByRoom[roomId]) ? state.messagesByRoom[roomId] : [];
      state.messagesByRoom[roomId] = current.filter((item) => Number(item.message_id) !== Number(messageId));
    },
    setRoomTyping(state, action) {
      const { roomId, userIds } = action.payload || {};
      if (!roomId) return;
      state.typingByRoom[roomId] = Array.isArray(userIds) ? userIds : [];
    },
    resetChatState() {
      return initialState;
    },
  },
});

export const {
  setChatLoading,
  setChatError,
  setChatEntries,
  setActiveEntryId,
  setRoomMessages,
  upsertRoomMessage,
  removeRoomMessage,
  setRoomTyping,
  resetChatState,
} = chatSlice.actions;

export default chatSlice.reducer;
