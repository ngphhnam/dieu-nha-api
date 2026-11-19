import { Router } from 'express';
import {
  trackEvents,
  heartbeat,
  getPublicStats,
  getAnalyticsSummary,
  getActivityLogs,
  getVisitorSessions,
  clearActivityLogs,
} from '../controllers/analytics.controller.js';
import { authenticate, optionalAuth, requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// Public tracking & visitor stats
router.post('/track', optionalAuth, trackEvents);
router.post('/heartbeat', optionalAuth, heartbeat);
router.get('/stats', getPublicStats);

// Admin analytics & audit logs
router.get('/summary', authenticate, requireAdmin, getAnalyticsSummary);
router.get('/logs', authenticate, requireAdmin, getActivityLogs);
router.get('/sessions', authenticate, requireAdmin, getVisitorSessions);
router.delete('/logs/clear', authenticate, requireAdmin, clearActivityLogs);

export default router;
