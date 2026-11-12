import { Request, Response } from 'express';
import prisma from '../config/db.js';

// Lấy danh sách tài khoản Quản trị / Nhân viên hệ thống (users)
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy danh sách Khách hàng mua sắm (customers)
export const getCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        points: true,
        tier: true,
        address: true,
        city: true,
        createdAt: true,
        _count: {
          select: { orders: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: customers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });

    res.json({ success: true, message: 'Cập nhật tài khoản thành công.', data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
