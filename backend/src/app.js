const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const db = require("./db/knex");

// Import Routes
const authRoutes = require("./routes/auth.routes");
const anoRoutes = require("./routes/ano.routes");
const cadetRoutes = require("./routes/cadet.routes");
// const chatRoutes = require("./routes/chat.routes"); // Uncomment when chat is ready

const app = express();

// Middleware
app.use(cors()); // Allow requests from your frontend
app.use(express.json()); // Parse JSON request bodies

// ------------------------------------------
// 1. Health Check & DB Connection Test
// ------------------------------------------
app.get("/", async (req, res) => {
  try {
    await db.raw("SELECT 1+1 as result");
    res.status(200).json({ 
      status: "Online", 
      database: "Connected", 
      timestamp: new Date().toISOString() 
    });
  } catch (err) {
    console.error("Database Connection Error:", err);
    res.status(500).json({ 
      status: "Error", 
      message: "Database not connected" 
    });
  }
});

// ------------------------------------------
// 2. API Routes
// ------------------------------------------

// Authentication (Login, Reset Password)
// This mounts auth routes at /api/auth
app.use("/api/auth", authRoutes);

// ANO Dashboard (Stats, Add/Edit/Delete Cadet, Send Emails)
// This mounts ano routes at /api/ano
app.use("/api/ano", anoRoutes);
app.use("/api/cadet", cadetRoutes);

// Chat System (Existing)
// app.use("/api/chat", chatRoutes); // Uncomment when ready

// ------------------------------------------
// 3. Global Error Handler
// ------------------------------------------
app.use((err, req, res, next) => {
  console.error("Global Error:", err.stack);
  res.status(500).json({ 
    message: "Internal Server Error", 
    error: process.env.NODE_ENV === "development" ? err.message : undefined 
  });
});

// ------------------------------------------
// 4. Start Server
// ------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Auth: /api/auth`);
  console.log(`ANO:  /api/ano`);
  console.log(`Cadet:/api/cadet`);
});
