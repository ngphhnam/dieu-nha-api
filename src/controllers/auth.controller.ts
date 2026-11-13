import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';

const generateToken = (account: { id: string; email: string; role: string; name: string }) => {
  return jwt.sign(
    { id: account.id, email: account.email, role: account.role, name: account.name },
    process.env.JWT_SECRET || 'dieunha-secret',
    { expiresIn: '7d' }
  );
};

// Đăng ký tài khoản Khách hàng mua sắm (lưu vào bảng customers)
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, phone } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ họ tên, email và mật khẩu.' });
      return;
    }

    const existingCustomer = await prisma.customer.findUnique({ where: { email } });
    if (existingCustomer) {
      res.status(400).json({ success: false, message: 'Email này đã được đăng ký tài khoản khách hàng.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const customer = await prisma.customer.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        points: 50, // Welcome gift
        tier: 'Đồng',
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        points: true,
        tier: true,
        avatar: true,
      },
    });

    const token = generateToken({ ...customer, role: 'CUSTOMER' });
    res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công! Tặng bạn 50 điểm tích lũy.',
      data: { user: { ...customer, role: 'CUSTOMER' }, token },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Đăng nhập: Kiểm tra cả User (Quản trị) và Customer (Khách hàng)
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu.' });
      return;
    }

    // 1. Kiểm tra tài khoản Quản trị / Nhân viên trong bảng `users`
    const adminUser = await prisma.user.findUnique({ where: { email } });
    if (adminUser && adminUser.password) {
      const isMatch = await bcrypt.compare(password, adminUser.password);
      if (isMatch) {
        const token = generateToken(adminUser);
        const { password: _, ...userWithoutPass } = adminUser;
        res.json({
          success: true,
          message: 'Đăng nhập Quản trị viên thành công.',
          data: { user: userWithoutPass, token },
        });
        return;
      }
    }

    // 2. Kiểm tra tài khoản Khách hàng trong bảng `customers`
    const customer = await prisma.customer.findUnique({ where: { email } });
    if (customer && customer.password) {
      const isMatch = await bcrypt.compare(password, customer.password);
      if (isMatch) {
        const token = generateToken({ ...customer, role: 'CUSTOMER' });
        const { password: _, ...customerWithoutPass } = customer;
        res.json({
          success: true,
          message: 'Đăng nhập khách hàng thành công.',
          data: { user: { ...customerWithoutPass, role: 'CUSTOMER' }, token },
        });
        return;
      }
    }

    res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
      return;
    }

    if (req.user.role === 'ADMIN') {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) {
        res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
        return;
      }
      const { password: _, ...userWithoutPass } = user;
      res.json({ success: true, data: userWithoutPass });
      return;
    }

    const customer = await prisma.customer.findUnique({
      where: { id: req.user.id },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          include: { items: true },
        },
      },
    });

    if (!customer) {
      res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng.' });
      return;
    }

    const { password: _, ...customerWithoutPass } = customer;
    res.json({ success: true, data: customerWithoutPass });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
      return;
    }

    const { name, phone, address, city } = req.body;

    if (req.user.role === 'ADMIN') {
      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          name: name || undefined,
          phone: phone || undefined,
        },
      });
      res.json({ success: true, message: 'Cập nhật thông tin thành công.', data: updated });
      return;
    }

    const updated = await prisma.customer.update({
      where: { id: req.user.id },
      data: {
        name: name || undefined,
        phone: phone || undefined,
        address: address || undefined,
        city: city || undefined,
      },
    });

    res.json({ success: true, message: 'Cập nhật thông tin thành công.', data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
