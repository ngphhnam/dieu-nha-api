import { Router } from 'express';
import { getSettings, updateSetting } from '../controllers/setting.controller.js';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', getSettings);
router.post('/', authenticate, requireAdmin, updateSetting);

export default router;

