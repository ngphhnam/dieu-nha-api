import { Request, Response } from 'express';
import prisma from '../config/db.js';

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.siteSetting.findMany();
    const map: Record<string, any> = {};
    settings.forEach((s) => {
      try {
        map[s.key] = JSON.parse(s.value);
      } catch {
        map[s.key] = s.value;
      }
    });

    res.json({ success: true, data: map });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSetting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, value } = req.body;
    if (!key) {
      res.status(400).json({ success: false, message: 'Key is required.' });
      return;
    }

    const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
    const setting = await prisma.siteSetting.upsert({
      where: { key },
      update: { value: jsonValue },
      create: { key, value: jsonValue },
    });

    res.json({ success: true, message: 'Đã lưu cấu hình.', data: setting });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

