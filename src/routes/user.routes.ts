import { Router } from 'express';
import { getUsers, getCustomers, updateUserRole, updateCustomer } from '../controllers/user.controller.js';
import {
  registerDeviceToken,
  unregisterDeviceToken,
  testDevicePush,
} from '../controllers/device.controller.js';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// /api/v1/users/device-token -> Đăng ký FCM Push Notification cho App Mobile Admin
router.post('/device-token', authenticate, requireAdmin, registerDeviceToken);
router.delete('/device-token', authenticate, requireAdmin, unregisterDeviceToken);
router.post('/device-token/test', authenticate, requireAdmin, testDevicePush);

// /api/v1/users -> Lấy danh sách tài khoản Admin / Nhân sự
router.get('/', authenticate, requireAdmin, getUsers);

// /api/v1/users/customers -> Lấy danh sách Khách hàng riêng biệt
router.get('/customers', authenticate, requireAdmin, getCustomers);
router.put('/customers/:id', authenticate, requireAdmin, updateCustomer);

router.patch('/:id', authenticate, requireAdmin, updateUserRole);

export default router;
