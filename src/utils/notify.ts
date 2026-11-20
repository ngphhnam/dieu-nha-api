import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import prisma from '../config/db.js';

/**
 * Gửi thông báo đơn hàng mới qua:
 * 1. Telegram Bot (nếu có TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID)
 * 2. Firebase Cloud Messaging (FCM) tới app mobile Admin (nếu có FIREBASE_SERVICE_ACCOUNT_JSON
 *    hoặc FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY)
 */

const escapeHtml = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const money = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;

const PAYMENT_LABEL: Record<string, string> = {
  cod: 'COD (tiền mặt)',
  vietqr: 'Chuyển khoản VietQR',
};

let firebaseReady: boolean | null = null;

function initFirebaseAdmin(): boolean {
  if (firebaseReady !== null) return firebaseReady;
  if (getApps().length > 0) {
    firebaseReady = true;
    return true;
  }

  try {
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (rawJson && rawJson.trim()) {
      const parsed = rawJson.trim().startsWith('{')
        ? JSON.parse(rawJson)
        : JSON.parse(Buffer.from(rawJson, 'base64').toString('utf8'));
      initializeApp({ credential: cert(parsed) });
      firebaseReady = true;
      return true;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (projectId && clientEmail && privateKey) {
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
      firebaseReady = true;
      return true;
    }
  } catch (err) {
    console.error('[FCM] Lỗi khởi tạo Firebase Admin:', err);
  }

  firebaseReady = false;
  return false;
}

export interface OrderForNotify {
  orderCode: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerDistrict?: string | null;
  customerCity: string;
  customerNote?: string | null;
  totalAmount: number;
  shippingFee: number;
  discount: number;
  paymentMethod: string;
  paymentStatus: string;
  items: { productName: string; variantWeight: string; quantity: number; price: number }[];
}

async function sendTelegramNewOrder(order: OrderForNotify): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_CHAT_ID || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (!token || chatIds.length === 0) return;

  const items = order.items
    .map(
      (i) =>
        `• ${escapeHtml(i.productName)} (${escapeHtml(i.variantWeight)}) x${i.quantity} = ${money(
          i.price * i.quantity
        )}`
    )
    .join('\n');

  const address = [order.customerAddress, order.customerDistrict, order.customerCity]
    .filter(Boolean)
    .map(escapeHtml)
    .join(', ');

  const lines = [
    `🛒 <b>ĐƠN HÀNG MỚI #${escapeHtml(order.orderCode)}</b>`,
    '',
    `👤 ${escapeHtml(order.customerName)}`,
    `📞 <code>${escapeHtml(order.customerPhone)}</code>`,
    `📍 ${address}`,
    order.customerNote ? `📝 ${escapeHtml(order.customerNote)}` : '',
    '',
    items,
    '',
    order.discount > 0 ? `Giảm giá: -${money(order.discount)}` : '',
    `Phí ship: ${order.shippingFee > 0 ? money(order.shippingFee) : 'Miễn phí'}`,
    `💰 <b>Tổng: ${money(order.totalAmount)}</b>`,
    `💳 ${escapeHtml(PAYMENT_LABEL[order.paymentMethod] || order.paymentMethod)} — ${
      order.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'
    }`,
  ].filter((l, idx, arr) => l !== '' || arr[idx - 1] !== '');

  const text = lines.join('\n');

  await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) console.error(`[Telegram] Gửi tới ${chatId} lỗi:`, res.status, await res.text());
      } catch (err) {
        console.error(`[Telegram] Gửi tới ${chatId} lỗi:`, err);
      }
    })
  );
}

async function sendFcmNewOrder(order: OrderForNotify): Promise<void> {
  if (!initFirebaseAdmin()) return;

  const records = await prisma.deviceToken.findMany({ select: { token: true } });
  const tokens = records.map((r) => r.token);
  if (tokens.length === 0) return;

  const title = `🛒 Đơn hàng mới #${order.orderCode}`;
  const body = `${order.customerName} (${order.customerPhone}) • ${money(order.totalAmount)} (${
    order.items.length
  } SP)`;

  try {
    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: {
        type: 'new_order',
        orderCode: order.orderCode,
        totalAmount: String(order.totalAmount),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'orders_high',
          sound: 'default',
          priority: 'max',
          visibility: 'public',
        },
      },
    });

    // Tự động xóa token đã hết hạn / gỡ app
    const invalidTokens: string[] = [];
    response.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          invalidTokens.push(tokens[idx]);
        }
      }
    });
    if (invalidTokens.length > 0) {
      await prisma.deviceToken.deleteMany({ where: { token: { in: invalidTokens } } });
    }
  } catch (err) {
    console.error('[FCM] Gửi push đơn hàng mới lỗi:', err);
  }
}

export async function sendTestPush(token: string): Promise<{ ok: boolean; message: string }> {
  if (!initFirebaseAdmin()) {
    return {
      ok: false,
      message: 'Backend chưa cấu hình FIREBASE_SERVICE_ACCOUNT_JSON trên Render.',
    };
  }
  try {
    await getMessaging().send({
      token,
      notification: {
        title: '🔔 Điều Nhà Admin',
        body: 'Kết nối Push Notification thành công! Bạn sẽ nhận thông báo ngay khi có đơn hàng mới.',
      },
      android: { priority: 'high', notification: { sound: 'default' } },
    });
    return { ok: true, message: 'Đã gửi thông báo thử nghiệm tới điện thoại.' };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Gửi thông báo thử nghiệm thất bại.' };
  }
}

export async function notifyNewOrder(order: OrderForNotify): Promise<void> {
  await Promise.allSettled([sendTelegramNewOrder(order), sendFcmNewOrder(order)]);
}
