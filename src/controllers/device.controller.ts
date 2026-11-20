import { Response } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { sendTestPush } from '../utils/notify.js';

export const registerDeviceToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token, platform } = req.body || {};
    if (!token || typeof token !== 'string' || token.trim().length < 10) {
      res.status(400).json({ success: false, message: 'Device token không hợp lệ.' });
      return;
    }

    const userId = req.user?.id || 'admin';
    await prisma.deviceToken.upsert({
      where: { token: token.trim() },
      create: {
        userId,
        token: token.trim(),
        platform: typeof platform === 'string' ? platform : 'android',
      },
      update: {
        userId,
        platform: typeof platform === 'string' ? platform : 'android',
      },
    });

    res.json({ success: true, message: 'Đã đăng ký nhận thông báo đẩy.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const unregisterDeviceToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body || {};
    if (token && typeof token === 'string') {
      await prisma.deviceToken.deleteMany({ where: { token: token.trim() } });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const testDevicePush = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body || {};
    let targetToken = typeof token === 'string' ? token.trim() : '';
    if (!targetToken && req.user?.id) {
      const latest = await prisma.deviceToken.findFirst({
        where: { userId: req.user.id },
        orderBy: { updatedAt: 'desc' },
      });
      targetToken = latest?.token || '';
    }
    if (!targetToken) {
      res.status(400).json({ success: false, message: 'Chưa có thiết bị nào đăng ký token.' });
      return;
    }

    const result = await sendTestPush(targetToken);
    res.status(result.ok ? 200 : 400).json({ success: result.ok, message: result.message });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
