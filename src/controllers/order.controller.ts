import { Request, Response } from 'express';
import prisma from '../config/db.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';

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
    } = req.body;

    if (!customerName || !customerPhone || !customerAddress || !items || items.length === 0) {
      res.status(400).json({ success: false, message: 'Thông tin đặt hàng không đầy đủ.' });
      return;
    }

    // Generate unique order code (e.g. DH823912)
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const orderCode = `DH${randomNum}`;

    const order = await prisma.order.create({
      data: {
        orderCode,
        customerId: req.user?.id || null,
        customerName,
        customerPhone,
        customerAddress,
        customerCity: customerCity || 'TP. Hồ Chí Minh',
        customerDistrict,
        customerNote,
        subtotal: Number(subtotal),
        shippingFee: Number(shippingFee || 0),
        discount: Number(discount || 0),
        totalAmount: Number(totalAmount),
        paymentMethod: paymentMethod || 'cod',
        paymentStatus: paymentMethod === 'vietqr' ? 'paid' : 'unpaid',
        shippingStatus: 'pending',
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            productName: item.productName,
            variantId: item.variantId,
            variantWeight: item.variantWeight,
            price: Number(item.price),
            quantity: Number(item.quantity || 1),
            image: item.image,
          })),
        },
      },
      include: { items: true },
    });

    // Reward points if customer is logged in (1% of order value = points)
    if (req.user?.id && req.user?.role !== 'ADMIN') {
      const earnedPoints = Math.floor(Number(totalAmount) / 10000);
      try {
        await prisma.customer.update({
          where: { id: req.user.id },
          data: { points: { increment: earnedPoints } },
        });
      } catch {}
    }

    res.status(201).json({
      success: true,
      message: 'Đặt hàng thành công! Điều Nhà sẽ sớm liên hệ xác nhận đơn.',
      data: order,
    });
  } catch (error: any) {
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

