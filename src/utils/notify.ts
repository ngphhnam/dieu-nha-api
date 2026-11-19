/**
 * Gửi thông báo đơn hàng mới về Telegram (push về điện thoại).
 * Cần 2 biến môi trường: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
 * TELEGRAM_CHAT_ID có thể chứa nhiều ID, phân tách bằng dấu phẩy.
 * Nếu chưa cấu hình thì bỏ qua, không ảnh hưởng việc đặt hàng.
 */

const escapeHtml = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const money = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;

const PAYMENT_LABEL: Record<string, string> = {
  cod: 'COD (tiền mặt)',
  vietqr: 'Chuyển khoản VietQR',
};

interface OrderForNotify {
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

export async function notifyNewOrder(order: OrderForNotify): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_CHAT_ID || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (!token || chatIds.length === 0) return;

  const items = order.items
    .map((i) => `• ${escapeHtml(i.productName)} (${escapeHtml(i.variantWeight)}) x${i.quantity} = ${money(i.price * i.quantity)}`)
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
    `💳 ${escapeHtml(PAYMENT_LABEL[order.paymentMethod] || order.paymentMethod)} — ${order.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}`,
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
