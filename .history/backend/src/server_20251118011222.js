import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";            // <-- ADD THIS
import { Server } from "socket.io"; // <-- ADD THIS

import connectDB from "./config/db.js";
import redisClient from "./utils/redisClient.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import savedJobsRoutes from "./routes/savedRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import resumeRoutes from "./routes/resumeRoutes.js";
import { uploadPath } from "./middleware/uploadMiddleware.js";

dotenv.config();
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
connectDB();

app.use("/uploads", express.static(uploadPath));

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/save-jobs", savedJobsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/resume", resumeRoutes);

app.get("/", (req, res) => res.send("API is running..."));

/* ---------------------- SOCKET.IO SETUP ---------------------- */

const server = http.createServer(app); // create http server

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
  },
});

global.io = io; // make it accessible globally

io.on("connection", (socket) => {
  console.log("🔥 User connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

/* ------------------------------------------------------------- */

const PORT = process.env.PORT || 5000;

// IMPORTANT: use server.listen() not app.listen()
server.listen(PORT, () =>
  console.log(`🔥 Server + WebSocket running on port ${PORT}`)
);
