import { io } from "socket.io-client";
import { chatApiBaseUrl } from "./chatApi";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || chatApiBaseUrl;

let socket = null;
const normalizeMeetingId = (meetingId) =>
  Number(String(meetingId ?? "").trim().replace(/^:/, ""));

function getSocket() {
  return socket;
}

function connectChatSocket(token) {
  if (!token) return null;

  if (socket) {
    if (socket.auth?.token !== token) {
      socket.auth = { token };
      socket.disconnect();
      socket.connect();
    }
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 700,
    transports: ["websocket"],
  });

  return socket;
}

function connectSocket(token) {
  return connectChatSocket(token);
}

function disconnectChatSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

function bindChatSocketEvents(handlers = {}) {
  if (!socket) return;

  const { onNewMessage, onMessageDeleted, onReadUpdate, onTyping, onConnect, onError } = handlers;

  if (onConnect) {
    socket.off("connect", onConnect);
    socket.on("connect", onConnect);
  }

  if (onError) {
    socket.off("chat:error", onError);
    socket.on("chat:error", onError);
  }

  if (onNewMessage) {
    socket.off("chat:new_message", onNewMessage);
    socket.on("chat:new_message", onNewMessage);
  }

  if (onMessageDeleted) {
    socket.off("chat:message_deleted", onMessageDeleted);
    socket.on("chat:message_deleted", onMessageDeleted);
  }

  if (onReadUpdate) {
    socket.off("chat:read_update", onReadUpdate);
    socket.on("chat:read_update", onReadUpdate);
  }

  if (onTyping) {
    socket.off("chat:typing", onTyping);
    socket.on("chat:typing", onTyping);
  }
}

function joinSocketRoom(roomId) {
  if (!socket || !roomId) return;
  socket.emit("chat:join_room", { room_id: Number(roomId) });
}

function leaveSocketRoom(roomId) {
  if (!socket || !roomId) return;
  socket.emit("chat:leave_room", { room_id: Number(roomId) });
}

function sendSocketMessage({ roomId, body, messageType = "text", metadata = null }) {
  if (!socket || !roomId || !String(body || "").trim()) return false;

  socket.emit("chat:send_message", {
    room_id: Number(roomId),
    body,
    message_type: messageType,
    metadata,
  });

  return true;
}

function emitTyping({ roomId, isTyping }) {
  if (!socket || !roomId) return;
  socket.emit("chat:typing", { room_id: Number(roomId), is_typing: Boolean(isTyping) });
}

function emitRead({ roomId, upToMessageId = null }) {
  if (!socket || !roomId) return;
  socket.emit("chat:mark_read", {
    room_id: Number(roomId),
    up_to_message_id: upToMessageId,
  });
}

// -----------------------------
// MEETING SOCKET HELPERS
// -----------------------------

function joinMeetingRoom(meetingId) {
  if (!socket) {
    const token = localStorage.getItem("token");
    if (token) connectChatSocket(token);
  }
  const normalizedMeetingId = normalizeMeetingId(meetingId);
  if (!socket || !Number.isInteger(normalizedMeetingId) || normalizedMeetingId <= 0) return;
  socket.emit("meeting:joinRoom", { meetingId: normalizedMeetingId });
}

function leaveMeetingRoom(meetingId) {
  const normalizedMeetingId = normalizeMeetingId(meetingId);
  if (!socket || !Number.isInteger(normalizedMeetingId) || normalizedMeetingId <= 0) return;
  socket.emit("meeting:leaveRoom", { meetingId: normalizedMeetingId });
}

function bindMeetingSocketEvents(handlers = {}) {
  if (!socket) return;

  const {
    onMeetingStarted,
    onWaitingRequest,
    onUserAdmitted,
    onUserRejected,
    onUserLeft,
    onHostDisconnected,
    onHostReconnected,
    onMeetingEnded,
  } = handlers;

  if (onMeetingStarted) {
    socket.off("meeting:started", onMeetingStarted);
    socket.on("meeting:started", onMeetingStarted);
  }

  if (onWaitingRequest) {
    socket.off("meeting:waiting_request", onWaitingRequest);
    socket.on("meeting:waiting_request", onWaitingRequest);
  }

  if (onUserAdmitted) {
    socket.off("meeting:user_admitted", onUserAdmitted);
    socket.on("meeting:user_admitted", onUserAdmitted);
  }

  if (onUserRejected) {
    socket.off("meeting:user_rejected", onUserRejected);
    socket.on("meeting:user_rejected", onUserRejected);
  }

  if (onUserLeft) {
    socket.off("meeting:user_left", onUserLeft);
    socket.on("meeting:user_left", onUserLeft);
  }

  if (onHostDisconnected) {
    socket.off("meeting:host_disconnected", onHostDisconnected);
    socket.on("meeting:host_disconnected", onHostDisconnected);
  }

  if (onHostReconnected) {
    socket.off("meeting:host_reconnected", onHostReconnected);
    socket.on("meeting:host_reconnected", onHostReconnected);
  }

  if (onMeetingEnded) {
    socket.off("meeting:ended", onMeetingEnded);
    socket.on("meeting:ended", onMeetingEnded);
  }
}

export {
  getSocket,
  connectSocket,
  connectChatSocket,
  disconnectChatSocket,
  bindChatSocketEvents,
  joinSocketRoom,
  leaveSocketRoom,
  sendSocketMessage,
  emitTyping,
  emitRead,
  joinMeetingRoom,
  leaveMeetingRoom,
  bindMeetingSocketEvents,
};
