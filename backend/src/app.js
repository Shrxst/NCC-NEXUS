const dotenv = require("dotenv");
dotenv.config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const db = require("./db/knex");

const authRoutes = require("./routes/auth.routes");
const anoRoutes = require("./routes/ano.routes");
const cadetRoutes = require("./routes/cadet.routes");
const chatRoutes = require("./routes/chat.routes");
const { initChatSocket } = require("./sockets/chat.socket");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
});

app.locals.io = io;
app.locals.onlineUsers = new Set();
initChatSocket(io, { onlineUsers: app.locals.onlineUsers });

app.use(cors());
app.use(express.json());

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

app.use("/api/auth", authRoutes);
app.use("/api/ano", anoRoutes);
app.use("/api/cadet", cadetRoutes);
app.use("/api/chat", chatRoutes);

// Chat System (Existing)
app.use("/api/chat", chatRoutes);

// ------------------------------------------
// 3. Global Error Handler
// ------------------------------------------
app.use((err, req, res, next) => {
  console.error("Global Error:", err.stack);
  res.status(500).json({
    message: "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`   👉 Auth: /api/auth`);
  console.log(`   👉 ANO:  /api/ano`);
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("Auth: /api/auth");
  console.log("ANO: /api/ano");
  console.log("Cadet: /api/cadet");
  console.log("Chat: /api/chat");
  console.log("Socket.IO: enabled");
});
