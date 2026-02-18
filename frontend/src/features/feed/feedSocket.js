import { io } from "socket.io-client";

const FEED_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

let feedSocket = null;

export function connectFeedSocket(token) {
  if (!token) return null;

  if (feedSocket) {
    if (feedSocket.auth?.token !== token) {
      feedSocket.auth = { token };
      feedSocket.disconnect();
      feedSocket.connect();
    }
    return feedSocket;
  }

  feedSocket = io(`${FEED_URL}/feed`, {
    auth: { token },
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
  });

  return feedSocket;
}

export function getFeedSocket() {
  return feedSocket;
}

export function disconnectFeedSocket() {
  if (!feedSocket) return;
  feedSocket.removeAllListeners();
  feedSocket.disconnect();
  feedSocket = null;
}

