import { Response, NextFunction } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from './auth.middleware.js';
import { getClientIp } from '../utils/ip.js';

/**
 * Tự động ghi log các thao tác API quan trọng (POST/PUT/PATCH/DELETE) vào ActivityLog.
 * Bỏ qua các endpoint /analytics để tránh vòng lặp log.
 */
export const apiActivityLogger = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const method = req.method.toUpperCase();
  const path = req.originalUrl || req.path;

  if (
    method === 'GET' ||
    method === 'OPTIONS' ||
    method === 'HEAD' ||
    path.includes('/analytics')
  ) {
    next();
    return;
  }

  const start = Date.now();
  const ip = getClientIp(req);
  const sessionId = (req.headers['x-session-id'] as string) || `api-${ip}`;

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const category = path.includes('/auth')
      ? 'auth'
      : path.includes('/orders')
      ? 'commerce'
      : 'system';

    const action = `api_${method.toLowerCase()}`;

    prisma.activityLog
      .create({
        data: {
          sessionId,
          ip,
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          action,
          category,
          target: `${method} ${path.split('?')[0]}`,
          path: path.split('?')[0],
          metadata: JSON.stringify({
            statusCode: res.statusCode,
            durationMs,
          }),
        },
      })
      .catch(() => {
        // Không làm ảnh hưởng tới luồng chính nếu ghi log lỗi
      });
  });

  next();
};
