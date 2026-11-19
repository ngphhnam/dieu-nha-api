import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { optionalAuth } from './middlewares/auth.middleware.js';
import { apiActivityLogger } from './middlewares/activityLogger.middleware.js';

dotenv.config();

const app = express();
app.set('trust proxy', true);
const port = process.env.PORT || 5000;

const clientEnv = process.env.CLIENT_URL || '';
const envOrigins = clientEnv ? clientEnv.split(',').map((url) => url.trim()) : [];

const allowedOrigins = Array.from(
  new Set([
    ...envOrigins,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://dieunha.store',
    'https://www.dieunha.store',
  ])
);

// Security & Utility Middlewares
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép requests không có origin (ví dụ: mobile apps, curl, Postman) hoặc nằm trong danh sách whitelist
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Main API Route
app.use('/api/v1', optionalAuth, apiActivityLogger, apiRoutes);

// Root fallback
app.get('/', (req, res) => {
  res.send('🌿 Dieu Nha Cashew E-commerce API is running on /api/v1');
});

// Global Error Handler
app.use(errorHandler);

app.listen(port, () => {
  console.log(`🚀 Dieu Nha Backend API server listening at http://localhost:${port}`);
  console.log(`📚 Health check endpoint: http://localhost:${port}/api/v1/health`);
});

