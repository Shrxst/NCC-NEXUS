const dotenv = require("dotenv");
dotenv.config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { initChatSocket } = require("./sockets/chat.socket");
const { initFeedSocket } = require("./sockets/feed.socket");
const { initNotificationSocket } = require("./sockets/notification.socket");
const { initMeetingSocket } = require("./sockets/meeting.socket");
const db = require("./db/knex");

const authRoutes = require("./routes/auth.routes");
const anoRoutes = require("./routes/ano.routes");
const cadetRoutes = require("./routes/cadet.routes");
const chatRoutes = require("./routes/chat.routes");
const postRoutes = require("./routes/post.routes");
const donationRoutes = require("./routes/donation.routes");
const notificationRoutes = require("./routes/notification.routes");
const attendanceRoutes = require("./modules/attendance/attendance.routes");
const quizRoutes = require("./modules/quiz/routes/quiz.routes");
const leaveRoutes = require("./modules/leave/leave.routes");
const fineRoutes = require("./modules/fines/fine.routes");
const meetingRoutes = require("./modules/meetings/meeting.routes");
const communityRoutes = require("./modules/community/community.routes");
const { startCommunityPollNotifier } = require("./modules/community/community.poll-notifier");

const app = express();
const server = http.createServer(app);

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
// Initialize sockets
initChatSocket(io, { onlineUsers: app.locals.onlineUsers });
initFeedSocket(io);
initNotificationSocket(io);
initMeetingSocket(io);
startCommunityPollNotifier(io);

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
app.use("/api/attendance", attendanceRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/fines", fineRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/community", communityRoutes);
// 9. Global Error Handler
// ------------------------------------------
app.use((err, req, res, next) => {
  if (err?.name === "MulterError") {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Uploaded file exceeds 10MB limit"
        : err.message || "Upload error";
    return res.status(status).json({ message });
  }

  const status = Number(err.status || err.statusCode || 500);
  const message = status >= 500 ? "Internal Server Error" : err.message;
  console.error("Global Error:", err.stack || err);
  res.status(status).json({
    message,
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
