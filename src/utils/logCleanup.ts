import prisma from '../config/db.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Xoá log thao tác cũ hơn LOG_RETENTION_DAYS (mặc định 90 ngày). Chạy lúc khởi động và mỗi 24h. */
export function scheduleLogCleanup(): void {
  const days = Number(process.env.LOG_RETENTION_DAYS) || 90;

  const run = async () => {
    try {
      const { count } = await prisma.activityLog.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - days * DAY_MS) } },
      });
      if (count > 0) console.log(`[LogCleanup] Đã xoá ${count} log cũ hơn ${days} ngày`);
    } catch (err) {
      console.error('[LogCleanup] Lỗi:', err);
    }
  };

  run();
  setInterval(run, DAY_MS).unref();
}
