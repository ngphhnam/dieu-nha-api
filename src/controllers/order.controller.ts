import { Request, Response } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { notifyNewOrder } from '../utils/notify.js';

export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      customerName,
      customerPhone,
      customerAddress,
      customerCity,
      customerDistrict,
      customerNote,
      items,
      subtotal,
      shippingFee,
      discount,
      totalAmount,
      paymentMethod,
      paymentStatus,
    } = req.body;

    if (!customerName || !customerPhone || !customerAddress || !items || items.length === 0) {
      res.status(400).json({ success: false, message: 'Thông tin đặt hàng không đầy đủ.' });
      return;
    }

    // Verify valid customer if logged in
    let validCustomerId: string | null = null;
    if (req.user?.id) {
      const customer = await prisma.customer.findUnique({
        where: { id: req.user.id },
      });
      if (customer) {
        validCustomerId = customer.id;
      }
    }

    // Check valid productIds in DB
    const inputProductIds = items
      .map((i: any) => i.productId)
      .filter((id: any): id is string => typeof id === 'string' && id.length > 0);

    const existingProducts = await prisma.product.findMany({
      where: { id: { in: inputProductIds } },
      select: { id: true },
    });
    const validProductIdSet = new Set(existingProducts.map((p) => p.id));

    // Generate unique order code (e.g. DH823912)
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const orderCode = `DH${randomNum}`;

    const finalPaymentStatus =
      paymentStatus || (paymentMethod === 'vietqr' ? 'paid' : 'unpaid');

    const order = await prisma.order.create({
      data: {
        orderCode,
        customerId: validCustomerId,
        customerName,
        customerPhone,
        customerAddress,
        customerCity: customerCity || 'TP. Hồ Chí Minh',
        customerDistrict: customerDistrict || '',
        customerNote: customerNote || '',
        subtotal: Number(subtotal) || 0,
        shippingFee: Number(shippingFee || 0),
        discount: Number(discount || 0),
        totalAmount: Number(totalAmount) || 0,
        paymentMethod: paymentMethod || 'cod',
        paymentStatus: finalPaymentStatus,
        shippingStatus: 'pending',
        items: {
          create: items.map((item: any) => ({
            productId: validProductIdSet.has(item.productId) ? item.productId : null,
            variantId: item.variantId || 'standard',
            productName: item.productName || 'Hạt Điều Nhà',
            variantWeight: item.variantWeight || 'Hộp tiêu chuẩn',
            price: Number(item.price || 0),
            quantity: Number(item.quantity || 1),
            image: item.image || null,
          })),
        },
      },
      include: { items: true },
    });

    // Reward points & update customer default address if customer is logged in
    if (validCustomerId) {
      const earnedPoints = Math.floor(Number(totalAmount) / 10000);
      try {
        await prisma.customer.update({
          where: { id: validCustomerId },
          data: {
            points: { increment: earnedPoints },
            phone: customerPhone || undefined,
            address: customerAddress || undefined,
            city: customerCity || undefined,
          },
        });
      } catch {}
    }

    // Push thông báo về Telegram (không chờ, không làm chậm/lỗi việc đặt hàng)
    notifyNewOrder(order).catch(() => {});

      res.status(201).json({
        success: true,
        message: 'Đặt hàng thành công! Điều Nhà sẽ sớm liên hệ xác nhận đơn.',
        data: order,
      });
    } catch (error: any) {
      console.error('Error creating order:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  };

  export const getOrders = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { status, search } = req.query;
      const where: any = {};
      if (status && status !== 'all') {
        where.shippingStatus = String(status);
      }
      if (search) {
        where.OR = [
          { orderCode: { contains: String(search) } },
          { customerName: { contains: String(search) } },
          { customerPhone: { contains: String(search) } },
        ];
      }

      const orders = await prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, data: orders });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { shippingStatus, paymentStatus } = req.body;

      const data: any = {};
      if (shippingStatus) data.shippingStatus = shippingStatus;
      if (paymentStatus) data.paymentStatus = paymentStatus;

      const order = await prisma.order.update({
        where: { id },
        data,
        include: { items: true },
      });

      res.json({ success: true, message: 'Cập nhật trạng thái đơn hàng thành công.', data: order });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

