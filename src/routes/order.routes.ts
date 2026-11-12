import { Router } from 'express';
import {
  createOrder,
  getOrders,
  updateOrderStatus,
} from '../controllers/order.controller.js';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// Public / Authenticated customers can create order
router.post('/', createOrder);

// Admin can view and update orders
router.get('/', authenticate, requireAdmin, getOrders);
router.patch('/:id/status', authenticate, requireAdmin, updateOrderStatus);

export default router;

