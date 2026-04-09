import express, { Application, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

// Load env vars
dotenv.config();

// Database
import connectDB from './config/database';

// Middleware
import errorHandler from './middleware/errorHandler';

// Routes
import authRoutes from './routes/auth';
import memberRoutes from './routes/members';
import loanRoutes from './routes/loans';
import transactionRoutes from './routes/transactions';
import notificationRoutes from './routes/notifications';
import dashboardRoutes from './routes/dashboard';
import auditLogRoutes from './routes/auditLogs';
import simulationRoutes from './routes/simulation';
import repaymentRoutes from './routes/repayments';
import savingsHistoryRoutes from './routes/savingsHistory';
import userRoutes from './routes/users';
import mpesaRoutes from './routes/mpesa';
import configRoutes from './routes/config';
import sharesRoutes from './routes/shares';
import communicationsRoutes from './routes/communications';
import savingsInterestRoutes from './routes/savingsInterest';
import { startOverdueRepaymentJob } from './utils/overdueRepayments';

// Initialize app
const app: Application = express();

// Render/other reverse proxies forward the client IP in X-Forwarded-For.
// trust proxy must be enabled so rate limiting and req.ip work correctly.
app.set('trust proxy', 1);

// Connect to database
connectDB();

const overdueIntervalMinutes = Number(process.env.OVERDUE_JOB_INTERVAL_MINUTES) || 60;
startOverdueRepaymentJob(overdueIntervalMinutes);

// Security middleware
app.use(helmet());

// CORS
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  'https://www.smcf.app',
  'https://smcf.app',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) return callback(null, true);
    // Allow any vercel.app subdomain + explicit allowlist
    if (ALLOWED_ORIGINS.includes(origin) || /\.vercel\.app$/.test(origin) || /\.smcf\.app$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
const isDev = process.env.NODE_ENV === 'development';
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const rateLimitMaxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
const authLoginMaxRequests =
  Number(process.env.RATE_LIMIT_AUTH_LOGIN_MAX) || (isDev ? 1000 : rateLimitMaxRequests);
const disableAuthLoginLimiter =
  isDev && String(process.env.RATE_LIMIT_AUTH_LOGIN_DISABLED || '').toLowerCase() === 'true';

const getClientIp = (req: Request): string => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return String(forwardedFor[0]).trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  return req.ip;
};

const rateLimitHandler = (req: Request, res: Response) => {
  const rateLimitInfo = (req as { rateLimit?: { resetTime?: Date } }).rateLimit;
  const resetTimeMs = rateLimitInfo?.resetTime?.getTime();
  const retryAfterSeconds = resetTimeMs
    ? Math.max(1, Math.ceil((resetTimeMs - Date.now()) / 1000))
    : Math.ceil(rateLimitWindowMs / 1000);

  res.status(429).json({
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfterSeconds,
  });
};

const authLoginLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: authLoginMaxRequests,
  keyGenerator: (req) => getClientIp(req),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => disableAuthLoginLimiter,
  handler: rateLimitHandler,
});

const limiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: rateLimitMaxRequests,
  keyGenerator: (req) => getClientIp(req),
  skip: (req) => req.path === '/health' || req.path === '/auth/login',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

app.use('/api/auth/login', authLoginLimiter);
app.use('/api/', limiter);

// Health check
const healthHandler = (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
};

app.get(['/health', '/api/health'], healthHandler);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/repayments', repaymentRoutes);
app.use('/api/savings-history', savingsHistoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/config', configRoutes);
app.use('/api/shares', sharesRoutes);
app.use('/api/savings-interest', savingsInterestRoutes);
app.use('/api/communications', communicationsRoutes);
app.use('/api/email', communicationsRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

export default app;
