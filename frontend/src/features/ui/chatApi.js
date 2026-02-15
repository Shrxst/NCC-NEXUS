const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch (_error) {
    return null;
  }
}

function normalizeRole(role, rank) {
  const value = String(role || "").trim().toLowerCase();
  const rankValue = String(rank || "").trim().toLowerCase();

  if (value === "cadet" && rankValue === "senior under officer") return "suo";
  if (value === "senior under officer") return "suo";
  if (value === "cadet" || value === "suo" || value === "ano" || value === "alumni") return value;
  return "cadet";
}

export function getAuthContext(fallbackRole = "cadet") {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const decoded = token ? decodeJwtPayload(token) : null;

  return {
    token,
    userId: Number(user.user_id || decoded?.user_id || 0),
    userName: user.name || user.email || user.username || "Me",
    role: normalizeRole(fallbackRole || user.role || decoded?.role || localStorage.getItem("role"), decoded?.rank),
  };
}

async function request(path, { token, method = "GET", body, query } = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (query && typeof query === "object") {
    Object.entries(query).forEach(([key, value]) => {
      if (typeof value !== "undefined" && value !== null && String(value).length > 0) {
        url.searchParams.set(key, value);
      }
    });
  }

  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: typeof body === "undefined" ? undefined : JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const errorMessage = payload?.error?.message || payload?.message || "Request failed";
    throw new Error(errorMessage);
  }

  return payload;
}

export function fetchChatListApi({ userId, token, filter = "all" }) {
  return request(`/api/chat/list/${userId}`, {
    token,
    method: "GET",
    query: { filter },
  });
}

export function fetchCollegeUsersApi({ userId, token, filter = "all" }) {
  return request(`/api/chat/users/${userId}`, {
    token,
    method: "GET",
    query: { filter },
  });
}

export function createDirectRoomApi({ peerUserId, token }) {
  return request("/api/chat/room", {
    token,
    method: "POST",
    body: {
      room_type: "direct",
      participant_user_ids: [peerUserId],
    },
  });
}

export function fetchRoomMessagesApi({ roomId, token, limit = 50, beforeMessageId = null }) {
  return request(`/api/chat/messages/${roomId}`, {
    token,
    method: "GET",
    query: {
      limit,
      before_message_id: beforeMessageId,
    },
  });
}

export function sendMessageApi({ roomId, token, body, messageType = "text", metadata = null }) {
  return request("/api/chat/message", {
    token,
    method: "POST",
    body: {
      room_id: roomId,
      body,
      message_type: messageType,
      metadata,
    },
  });
}

export function markAsReadApi({ roomId, token, upToMessageId = null }) {
  return request("/api/chat/read", {
    token,
    method: "PATCH",
    body: {
      room_id: roomId,
      up_to_message_id: upToMessageId,
    },
  });
}

export const chatApiBaseUrl = API_BASE_URL;
