import { Response } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { getClientIp, parseUserAgent } from '../utils/ip.js';

const ONLINE_WINDOW_MS = 2 * 60 * 1000; // 2 phút

interface IncomingEvent {
  action?: string;
  category?: string;
  target?: string;
  path?: string;
  metadata?: unknown;
  timestamp?: string;
}

function getStartOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * POST /api/v1/analytics/track
 * Nhận 1 event hoặc mảng events từ frontend, cập nhật VisitorSession và lưu ActivityLog
 */
export const trackEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = req.body || {};
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || undefined;
    const { device, browser, os } = parseUserAgent(userAgent);

    const sessionId: string =
      (typeof body.sessionId === 'string' && body.sessionId.trim()) ||
      (req.headers['x-session-id'] as string) ||
      `anon-${ip}`;

    const userId = req.user?.id || (typeof body.userId === 'string' ? body.userId : null);
    const userName = req.user?.name || (typeof body.userName === 'string' ? body.userName : null);
    const userEmail = req.user?.email || (typeof body.userEmail === 'string' ? body.userEmail : null);
    const referrer = typeof body.referrer === 'string' ? body.referrer.slice(0, 500) : null;

    const rawEvents: IncomingEvent[] = Array.isArray(body.events)
      ? body.events
      : body.action
      ? [body]
      : [];

    if (rawEvents.length === 0) {
      res.json({ success: true, recorded: 0 });
      return;
    }

    const cappedEvents = rawEvents.slice(0, 50);
    const pageViewCount = cappedEvents.filter((e) => e.action === 'page_view').length;
    const lastPath =
      [...cappedEvents].reverse().find((e) => typeof e.path === 'string' && e.path)?.path ||
      body.path ||
      '/';
    const firstPath =
      cappedEvents.find((e) => typeof e.path === 'string' && e.path)?.path || lastPath;

    const now = new Date();

    // Upsert phiên truy cập
    await prisma.visitorSession.upsert({
      where: { sessionId },
      create: {
        sessionId,
        ip,
        userAgent: userAgent?.slice(0, 500) || null,
        device,
        browser,
        os,
        userId,
        userName,
        userEmail,
        firstPath: String(firstPath).slice(0, 300),
        lastPath: String(lastPath).slice(0, 300),
        referrer,
        pageViews: Math.max(pageViewCount, 1),
        eventsCount: cappedEvents.length,
        lastSeenAt: now,
      },
      update: {
        ip,
        lastSeenAt: now,
        lastPath: String(lastPath).slice(0, 300),
        pageViews: pageViewCount > 0 ? { increment: pageViewCount } : undefined,
        eventsCount: { increment: cappedEvents.length },
        ...(userId ? { userId } : {}),
        ...(userName ? { userName } : {}),
        ...(userEmail ? { userEmail } : {}),
      },
    });

    // Lưu hàng loạt ActivityLog
    const logsData = cappedEvents.map((ev) => ({
      sessionId,
      ip,
      userAgent: userAgent?.slice(0, 500) || null,
      userId,
      userName,
      userEmail,
      action: String(ev.action || 'event').slice(0, 80),
      category: String(ev.category || 'interaction').slice(0, 40),
      target: ev.target ? String(ev.target).slice(0, 300) : null,
      path: String(ev.path || lastPath || '/').slice(0, 300),
      metadata:
        ev.metadata !== undefined && ev.metadata !== null
          ? typeof ev.metadata === 'string'
            ? ev.metadata.slice(0, 2000)
            : JSON.stringify(ev.metadata).slice(0, 2000)
          : null,
      createdAt: ev.timestamp ? new Date(ev.timestamp) : now,
    }));

    await prisma.activityLog.createMany({ data: logsData });

    res.json({ success: true, recorded: logsData.length });
  } catch (error) {
    console.error('[Analytics] trackEvents error:', error);
    res.status(500).json({ success: false, message: 'Không thể ghi nhận log.' });
  }
};

/**
 * POST /api/v1/analytics/heartbeat
 * Giữ trạng thái online cho phiên hiện tại
 */
export const heartbeat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = req.body || {};
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || undefined;
    const { device, browser, os } = parseUserAgent(userAgent);

    const sessionId: string =
      (typeof body.sessionId === 'string' && body.sessionId.trim()) ||
      (req.headers['x-session-id'] as string) ||
      `anon-${ip}`;

    const path = typeof body.path === 'string' ? body.path.slice(0, 300) : '/';
    const userId = req.user?.id || (typeof body.userId === 'string' ? body.userId : null);
    const userName = req.user?.name || (typeof body.userName === 'string' ? body.userName : null);
    const userEmail = req.user?.email || (typeof body.userEmail === 'string' ? body.userEmail : null);
    const now = new Date();

    await prisma.visitorSession.upsert({
      where: { sessionId },
      create: {
        sessionId,
        ip,
        userAgent: userAgent?.slice(0, 500) || null,
        device,
        browser,
        os,
        userId,
        userName,
        userEmail,
        firstPath: path,
        lastPath: path,
        pageViews: 1,
        eventsCount: 0,
        lastSeenAt: now,
      },
      update: {
        ip,
        lastSeenAt: now,
        lastPath: path,
        ...(userId ? { userId } : {}),
        ...(userName ? { userName } : {}),
        ...(userEmail ? { userEmail } : {}),
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Analytics] heartbeat error:', error);
    res.status(500).json({ success: false, message: 'Heartbeat thất bại.' });
  }
};

async function fetchCoreStats() {
  const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MS);
  const startOfToday = getStartOfToday();

  const [sessionRows, logRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        online_now: bigint;
        total_visits: bigint;
        today_visits: bigint;
        unique_ips: bigint;
        today_unique_ips: bigint;
      }>
    >`
      SELECT
        COUNT(*) FILTER (WHERE "lastSeenAt" >= ${onlineSince}) AS online_now,
        COUNT(*) AS total_visits,
        COUNT(*) FILTER (WHERE "createdAt" >= ${startOfToday}) AS today_visits,
        COUNT(DISTINCT "ip") AS unique_ips,
        COUNT(DISTINCT "ip") FILTER (WHERE "createdAt" >= ${startOfToday}) AS today_unique_ips
      FROM "visitor_sessions"
    `,
    prisma.$queryRaw<
      Array<{
        total_page_views: bigint;
        today_page_views: bigint;
        total_events: bigint;
      }>
    >`
      SELECT
        COUNT(*) FILTER (WHERE "action" = 'page_view') AS total_page_views,
        COUNT(*) FILTER (WHERE "action" = 'page_view' AND "createdAt" >= ${startOfToday}) AS today_page_views,
        COUNT(*) AS total_events
      FROM "activity_logs"
    `,
  ]);

  const s = sessionRows[0];
  const l = logRows[0];

  return {
    onlineNow: Number(s?.online_now ?? 0),
    totalVisits: Number(s?.total_visits ?? 0),
    todayVisits: Number(s?.today_visits ?? 0),
    totalPageViews: Number(l?.total_page_views ?? 0),
    todayPageViews: Number(l?.today_page_views ?? 0),
    totalEvents: Number(l?.total_events ?? 0),
    uniqueIps: Number(s?.unique_ips ?? 0),
    todayUniqueIps: Number(s?.today_unique_ips ?? 0),
  };
}

/**
 * GET /api/v1/analytics/stats (Public)
 * Trả về số liệu truy cập để hiển thị trực tiếp trên website & dashboard
 */
export const getPublicStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await fetchCoreStats();
    res.json({ success: true, data });
  } catch (error) {
    console.error('[Analytics] getPublicStats error:', error);
    res.status(500).json({ success: false, message: 'Không thể lấy thống kê truy cập.' });
  }
};

/**
 * GET /api/v1/analytics/summary (Admin)
 * Thống kê chuyên sâu: top pages, top actions, top IPs, traffic 7 ngày gần nhất
 */
export const getAnalyticsSummary = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Chạy theo batch nhỏ (2-3 query/lần) để tối ưu pool kết nối Supabase
    const stats = await fetchCoreStats();

    const [topPages, topActions, topIps] = await Promise.all([
      prisma.activityLog.groupBy({
        by: ['path'],
        where: { action: 'page_view' },
        _count: { path: true },
        orderBy: { _count: { path: 'desc' } },
        take: 8,
      }),
      prisma.activityLog.groupBy({
        by: ['action'],
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
      prisma.visitorSession.groupBy({
        by: ['ip'],
        _count: { ip: true },
        _sum: { pageViews: true, eventsCount: true },
        orderBy: { _count: { ip: 'desc' } },
        take: 10,
      }),
    ]);

    const [recentSessions, deviceBreakdown] = await Promise.all([
      prisma.visitorSession.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true, pageViews: true },
      }),
      prisma.visitorSession.groupBy({
        by: ['device'],
        _count: { device: true },
      }),
    ]);

    // Gom nhóm lượt truy cập 7 ngày gần nhất
    const dailyMap: Record<string, { date: string; visits: number; pageViews: number }> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(sevenDaysAgo.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { date: key, visits: 0, pageViews: 0 };
    }
    for (const s of recentSessions) {
      const key = s.createdAt.toISOString().slice(0, 10);
      if (dailyMap[key]) {
        dailyMap[key].visits += 1;
        dailyMap[key].pageViews += s.pageViews;
      }
    }

    res.json({
      success: true,
      data: {
        stats,
        topPages: topPages.map((p) => ({ path: p.path, views: p._count.path })),
        topActions: topActions.map((a) => ({ action: a.action, count: a._count.action })),
        topIps: topIps.map((item) => ({
          ip: item.ip,
          sessions: item._count.ip,
          pageViews: item._sum.pageViews || 0,
          eventsCount: item._sum.eventsCount || 0,
        })),
        devices: deviceBreakdown.map((d) => ({
          device: d.device || 'Unknown',
          count: d._count.device,
        })),
        dailyTraffic: Object.values(dailyMap),
      },
    });
  } catch (error) {
    console.error('[Analytics] getAnalyticsSummary error:', error);
    res.status(500).json({ success: false, message: 'Không thể lấy báo cáo tổng hợp.' });
  }
};

/**
 * GET /api/v1/analytics/logs (Admin)
 * Danh sách log thao tác có lọc & phân trang
 */
export const getActivityLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const skip = (page - 1) * limit;

    const action = req.query.action ? String(req.query.action).trim() : undefined;
    const category = req.query.category ? String(req.query.category).trim() : undefined;
    const ip = req.query.ip ? String(req.query.ip).trim() : undefined;
    const sessionId = req.query.sessionId ? String(req.query.sessionId).trim() : undefined;
    const search = req.query.search ? String(req.query.search).trim() : undefined;

    const where: any = {};
    if (action && action !== 'all') where.action = action;
    if (category && category !== 'all') where.category = category;
    if (ip) where.ip = { contains: ip, mode: 'insensitive' };
    if (sessionId) where.sessionId = sessionId;
    if (search) {
      where.OR = [
        { ip: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { target: { contains: search, mode: 'insensitive' } },
        { path: { contains: search, mode: 'insensitive' } },
        { userName: { contains: search, mode: 'insensitive' } },
        { userEmail: { contains: search, mode: 'insensitive' } },
        { metadata: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Analytics] getActivityLogs error:', error);
    res.status(500).json({ success: false, message: 'Không thể lấy danh sách log.' });
  }
};

/**
 * GET /api/v1/analytics/sessions (Admin)
 * Danh sách phiên truy cập (IP, thiết bị, trạng thái online)
 */
export const getVisitorSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const skip = (page - 1) * limit;

    const onlineOnly = req.query.onlineOnly === 'true';
    const search = req.query.search ? String(req.query.search).trim() : undefined;
    const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MS);

    const where: any = {};
    if (onlineOnly) {
      where.lastSeenAt = { gte: onlineSince };
    }
    if (search) {
      where.OR = [
        { ip: { contains: search, mode: 'insensitive' } },
        { userName: { contains: search, mode: 'insensitive' } },
        { userEmail: { contains: search, mode: 'insensitive' } },
        { lastPath: { contains: search, mode: 'insensitive' } },
        { browser: { contains: search, mode: 'insensitive' } },
        { os: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [sessions, total] = await Promise.all([
      prisma.visitorSession.findMany({
        where,
        orderBy: { lastSeenAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.visitorSession.count({ where }),
    ]);

    const nowMs = Date.now();
    const enriched = sessions.map((s) => ({
      ...s,
      isOnline: nowMs - new Date(s.lastSeenAt).getTime() <= ONLINE_WINDOW_MS,
    }));

    res.json({
      success: true,
      data: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Analytics] getVisitorSessions error:', error);
    res.status(500).json({ success: false, message: 'Không thể lấy danh sách phiên truy cập.' });
  }
};

/**
 * DELETE /api/v1/analytics/logs/clear (Admin)
 * Dọn dẹp log cũ hơn N ngày (hoặc xóa hết nếu days=0)
 */
export const clearActivityLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const days = parseInt(String(req.query.days ?? '30'), 10);
    if (isNaN(days) || days < 0) {
      res.status(400).json({ success: false, message: 'Tham số days không hợp lệ.' });
      return;
    }

    const where =
      days === 0
        ? {}
        : {
            createdAt: {
              lt: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
            },
          };

    const deleted = await prisma.activityLog.deleteMany({ where });
    res.json({
      success: true,
      message: `Đã xóa ${deleted.count} bản ghi log.`,
      deletedCount: deleted.count,
    });
  } catch (error) {
    console.error('[Analytics] clearActivityLogs error:', error);
    res.status(500).json({ success: false, message: 'Không thể xóa log.' });
  }
};
