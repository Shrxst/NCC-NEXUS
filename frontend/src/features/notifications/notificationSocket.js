import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

let notificationSocket = null;

export function connectNotificationSocket(token) {
  if (!token) return null;

  if (notificationSocket) {
    if (notificationSocket.auth?.token !== token) {
      notificationSocket.auth = { token };
      notificationSocket.disconnect();
      notificationSocket.connect();
    }
    return notificationSocket;
  }

  notificationSocket = io(`${SOCKET_URL}/notifications`, {
    auth: { token },
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
  });

  return notificationSocket;
}

export function getNotificationSocket() {
  return notificationSocket;
}

export function disconnectNotificationSocket() {
  if (!notificationSocket) return;
  notificationSocket.removeAllListeners();
  notificationSocket.disconnect();
  notificationSocket = null;
}

