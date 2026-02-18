const jwt = require("jsonwebtoken");

function parseNotificationUser(socket) {
  const auth = socket.handshake.auth || {};
  const headers = socket.handshake.headers || {};

  const bearer = headers.authorization;
  const token =
    auth.token ||
    (typeof bearer === "string" && bearer.startsWith("Bearer ")
      ? bearer.slice(7)
      : null);

  if (!token) {
    throw new Error("Missing token.");
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  return {
    userId: decoded.user_id,
  };
}

function initNotificationSocket(io) {
  const nsp = io.of("/notifications");

  nsp.use((socket, next) => {
    try {
      socket.data.user = parseNotificationUser(socket);
      next();
    } catch (err) {
      next(new Error("Notification socket auth failed."));
    }
  });

  nsp.on("connection", (socket) => {
    const { userId } = socket.data.user;

    // Each user joins their own room
    socket.join(`notifications:user:${userId}`);

    socket.emit("notification:connected", { user_id: userId });
  });
}

module.exports = {
  initNotificationSocket,
};
