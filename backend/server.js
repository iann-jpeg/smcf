// Load environment variables FIRST before any other imports
import dotenv from "dotenv";
dotenv.config();

// Log startup information
console.log('\n🚀 SMCF Backend Starting...');
console.log('📡 Environment:', process.env.NODE_ENV || 'development');
console.log('🔌 Port:', process.env.PORT || '4000');
console.log('🗄️  MongoDB URI:', process.env.MONGODB_URI ? '✅ Set' : '❌ Not Set');
console.log('🔐 JWT Secret:', process.env.JWT_SECRET ? '✅ Set' : '❌ Not Set');
console.log('🌐 Client URL:', process.env.CLIENT_URL || 'Not Set');
console.log('');

import cors from "cors";
import express from "express";
import { createServer } from "http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import path from "path";

// Import routes
import adminRoutes from "./routes/admin.js";
import announcementRoutes from "./routes/announcements.js";
import authRoutes from "./routes/auth.js";
import creditScoreRoutes from "./routes/creditScore.js";
import cycleRoutes from "./routes/cycles.js";
import disbursementRoutes from "./routes/disbursements.js";
import lipiaRoutes from "./routes/lipia.js";
import loanRoutes from "./routes/loans.js";
import memberRoutes from "./routes/members.js";
import paymentRoutes from "./routes/payments.js";
import savingsRoutes from "./routes/savings.js";
import reserveRoutes from "./routes/reserve.js";
import analyticsRoutes from "./routes/analytics.js";

// Import interest service
import { startInterestCronJob } from "./services/interestService.js";
// Import late fees service
import { startLateFeesCronJob } from "./services/lateFeesService.js";
// Import loan due date fix service
import { startLoanDueDateCronJob } from "./services/loanDueDateService.js";
// Import maturity check service
import { checkMaturedDeposits } from "./services/maturityCheckService.js";

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO with proper CORS
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:3000",
  "https://localhost", // For Capacitor Android app
  "capacitor://localhost", // For iOS Capacitor
  "ionic://localhost", // For older Ionic apps
  "https://smcf.app",
  "https://www.smcf.app",
  "https://smcf-finance.vercel.app", // Vercel deployment
  process.env.CLIENT_URL,
].filter(Boolean);

console.log("🔓 Allowed CORS origins:", allowedOrigins);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
});

// Make io accessible to routes and globally for cron jobs
app.set("io", io);
global.io = io;

// Middleware - CORS must be first
app.use(
  cors({
    origin: allowedOrigins,
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
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI environment variable is not set!');
      if (process.env.NODE_ENV === 'production') {
        console.error('⚠️  Cannot start in production without MongoDB connection');
        process.exit(1);
      }
      console.log('ℹ️  Using default local MongoDB connection');
    }
    
    const mongooseOptions = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };
    
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/smcf",
      mongooseOptions
    );
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    
    if (process.env.NODE_ENV === 'production') {
      console.error('⚠️  Cannot start in production without MongoDB. Please check:');
      console.error('   1. MONGODB_URI environment variable is set correctly');
      console.error('   2. MongoDB Atlas network access allows connections from anywhere (0.0.0.0/0)');
      console.error('   3. Database user credentials are correct');
      console.error('   4. MongoDB cluster is not paused');
      process.exit(1);
    } else {
      console.error(`\n⚠️  MongoDB is not running. Please start MongoDB with:`);
      console.error(`   sudo systemctl start mongodb`);
      console.error(`   or`);
      console.error(`   mongod --dbpath /path/to/data\n`);
      process.exit(1);
    }
  }
};

connectDB();

// Track online users
const onlineUsers = new Map(); // Map of userId -> { socketId, username, role, timestamp }

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("✅ Socket.IO client connected:", socket.id);
  console.log("📍 Client origin:", socket.handshake.headers.origin);
  console.log("👥 Total connected clients:", io.engine.clientsCount);

  // Handle user authentication and tracking
  socket.on("user:online", (userData) => {
    if (userData && userData.userId) {
      onlineUsers.set(userData.userId, {
        socketId: socket.id,
        userId: userData.userId,
        username: userData.username,
        role: userData.role,
        timestamp: Date.now(),
      });

      console.log(`👤 User online: ${userData.username} (${userData.role})`);

      // Broadcast updated online users list to all clients
      const onlineUsersList = Array.from(onlineUsers.values()).map((user) => ({
        userId: user.userId,
        username: user.username,
        role: user.role,
        timestamp: user.timestamp,
      }));

      console.log(`📡 Broadcasting ${onlineUsersList.length} online users`);
      io.emit("users:online", onlineUsersList);
    }
  });

  // Handle request for current online users
  socket.on("request:online-users", () => {
    const onlineUsersList = Array.from(onlineUsers.values()).map((user) => ({
      userId: user.userId,
      username: user.username,
      role: user.role,
      timestamp: user.timestamp,
    }));

    console.log(
      `📡 Sending current online users list to ${socket.id}: ${onlineUsersList.length} users`
    );
    socket.emit("users:online", onlineUsersList);
  });

  socket.on("disconnect", (reason) => {
    console.log(
      "❌ Socket.IO client disconnected:",
      socket.id,
      "Reason:",
      reason
    );

    // Remove user from online list
    for (const [userId, userData] of onlineUsers.entries()) {
      if (userData.socketId === socket.id) {
        onlineUsers.delete(userId);
        console.log(`👤 User offline: ${userData.username}`);

        // Broadcast updated online users list
        const onlineUsersList = Array.from(onlineUsers.values()).map(
          (user) => ({
            userId: user.userId,
            username: user.username,
            role: user.role,
            timestamp: user.timestamp,
          })
        );

        console.log(
          `📡 Broadcasting updated list: ${onlineUsersList.length} users remaining`
        );
        io.emit("users:online", onlineUsersList);
        break;
      }
    }

    console.log("👥 Remaining clients:", io.engine.clientsCount);
  });
});

// Serve static files for receipts
app.use("/receipts", express.static(path.join(process.cwd(), "receipts")));

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
app.use("/api/savings", savingsRoutes);
app.use("/api/reserve", reserveRoutes);
app.use("/api/credit-score", creditScoreRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/reports", analyticsRoutes); // Alias to avoid ad blocker issues

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

  // Start interest calculation cron job
  startInterestCronJob();
  
  // Start late fees calculation cron job
  startLateFeesCronJob();

  // Start loan due date fix cron job
  startLoanDueDateCronJob();
  
  // Start daily maturity check (runs at midnight every day)
  setInterval(async () => {
    const now = new Date();
    // Run at midnight (00:00)
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      console.log("⏰ Running daily maturity check...");
      await checkMaturedDeposits();
    }
  }, 60000); // Check every minute
  
  // Run maturity check on startup
  setTimeout(async () => {
    console.log("🔍 Running initial maturity check...");
    await checkMaturedDeposits();
  }, 5000); // Run 5 seconds after startup
  
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
  console.log(`   Loans: http://localhost:${PORT}/api/loans`);
  console.log(`   Savings: http://localhost:${PORT}/api/savings\n`);
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} signal received: closing HTTP server`);
  
  httpServer.close(async () => {
    console.log('HTTP server closed');
    
    // Close database connection
    try {
      await mongoose.connection.close();
      console.log('MongoDB connection closed');
    } catch (error) {
      console.error('Error closing MongoDB connection:', error);
    }
    
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

export default app;
