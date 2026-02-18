// ------------------------------------------
// 1. Environment Configuration
// ------------------------------------------
const dotenv = require("dotenv");
dotenv.config();

// ------------------------------------------
// 2. Core Dependencies
// ------------------------------------------
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { initChatSocket } = require("./sockets/chat.socket");
const { initFeedSocket } = require("./sockets/feed.socket");
const { initNotificationSocket } = require("./sockets/notification.socket");
const db = require("./db/knex");

// ------------------------------------------
// 3. Route Imports
// ------------------------------------------
const authRoutes = require("./routes/auth.routes");
const anoRoutes = require("./routes/ano.routes");
const cadetRoutes = require("./routes/cadet.routes");
const chatRoutes = require("./routes/chat.routes");
const postRoutes = require("./routes/post.routes");
const notificationRoutes = require("./routes/notification.routes");

// ------------------------------------------
// 4. App & Server Setup
// ------------------------------------------
const app = express();
const server = http.createServer(app);

// ------------------------------------------
// 5. Socket.IO Setup
// ------------------------------------------
const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
});

// Make io globally accessible
app.locals.io = io;
app.locals.onlineUsers = new Set();

// Initialize chat socket
initChatSocket(io, { onlineUsers: app.locals.onlineUsers });
initFeedSocket(io);
initNotificationSocket(io);

// ------------------------------------------
// 6. Middleware
// ------------------------------------------
app.use(cors());
app.use(express.json());

// ------------------------------------------
// 7. Health Check Route
// ------------------------------------------
app.get("/", async (req, res) => {
  try {
    await db.raw("SELECT 1+1 as result");
    res.status(200).json({
      status: "Online",
      database: "Connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Database Connection Error:", err);
    res.status(500).json({
      status: "Error",
      message: "Database not connected",
    });
  }
});

// ------------------------------------------
// 8. API Routes
// ------------------------------------------
app.use("/api/auth", authRoutes);
app.use("/api/ano", anoRoutes);
app.use("/api/cadet", cadetRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/notifications", notificationRoutes);
// ------------------------------------------
// 9. Global Error Handler
// ------------------------------------------
app.use((err, req, res, next) => {
  console.error("Global Error:", err.stack);
  res.status(500).json({
    message: "Internal Server Error",
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : undefined,
  });
});

// ------------------------------------------
// 10. Start Server
// ------------------------------------------
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
