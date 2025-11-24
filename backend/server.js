// Load environment variables FIRST before any other imports
import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express from "express";
import { createServer } from "http";
import mongoose from "mongoose";
import { Server } from "socket.io";

// Import routes
import adminRoutes from "./routes/admin.js";
import announcementRoutes from "./routes/announcements.js";
import authRoutes from "./routes/auth.js";
import cycleRoutes from "./routes/cycles.js";
import disbursementRoutes from "./routes/disbursements.js";
import lipiaRoutes from "./routes/lipia.js";
import loanRoutes from "./routes/loans.js";
import memberRoutes from "./routes/members.js";
import paymentRoutes from "./routes/payments.js";

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO with proper CORS
const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:8080",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
});

// Make io accessible to routes
app.set("io", io);

// Middleware - CORS must be first
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:8080",
      "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/smcf"
    );
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(`\n⚠️  MongoDB is not running. Please start MongoDB with:`);
    console.error(`   sudo systemctl start mongodb`);
    console.error(`   or`);
    console.error(`   mongod --dbpath /path/to/data\n`);
    process.exit(1);
  }
};

connectDB();

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Routes
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/members", memberRoutes);
app.use("/members", memberRoutes); // Backward compatibility
app.use("/api/payments", paymentRoutes);
app.use("/api/lipia", lipiaRoutes);
app.use("/api/cycles", cycleRoutes);
app.use("/api/disbursements", disbursementRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/announcements", announcementRoutes); // Backward compatibility
app.use("/api/loans", loanRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "SMCF Backend API",
    version: "1.0.0",
    endpoints: {
      admin: "/api/admin",
      auth: "/api/auth",
      members: "/api/members",
      payments: "/api/payments",
      lipia: "/api/lipia",
      cycles: "/api/cycles",
      disbursements: "/api/disbursements",
      announcements: "/api/announcements",
      loans: "/api/loans",
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal server error",
  });
});

// Start server
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 SMCF Backend Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔌 Socket.IO enabled for real-time updates`);
  console.log(`\n📚 API Documentation:`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Admin Setup: http://localhost:${PORT}/api/admin/setup`);
  console.log(`   Auth: http://localhost:${PORT}/api/auth`);
  console.log(`   Members: http://localhost:${PORT}/api/members`);
  console.log(`   Payments: http://localhost:${PORT}/api/payments`);
  console.log(`   Lipia: http://localhost:${PORT}/api/lipia`);
  console.log(`   Cycles: http://localhost:${PORT}/api/cycles`);
  console.log(`   Disbursements: http://localhost:${PORT}/api/disbursements`);
  console.log(`   Announcements: http://localhost:${PORT}/api/announcements`);
  console.log(`   Loans: http://localhost:${PORT}/api/loans\n`);
});

export default app;
