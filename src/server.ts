import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Security & Utility Middlewares
app.use(helmet());
app.use(
  cors({
    origin: [process.env.CLIENT_URL || 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Main API Route
app.use('/api/v1', apiRoutes);

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

