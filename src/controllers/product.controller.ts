import { Request, Response } from 'express';
import prisma from '../config/db.js';

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, featured } = req.query;
    const where: any = {};
    if (category && category !== 'all') {
      where.category = String(category);
    }
    if (featured === 'true') {
      where.featured = true;
    }

    const products = await prisma.product.findMany({
      where,
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
    });

    const parsed = products.map((p) => ({
      ...p,
      images: JSON.parse(p.images),
    }));

    res.json({ success: true, data: parsed });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProductBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const product = await prisma.product.findUnique({
      where: { slug },
      include: { variants: true },
    });

    if (!product) {
      res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại.' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...product,
        images: JSON.parse(product.images),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      id,
      name,
      slug,
      category,
      categoryName,
      badge,
      shortDesc,
      description,
      origin,
      spec,
      ingredients,
      shelfLife,
      featured,
      images,
      variants,
    } = req.body;

    const product = await prisma.product.create({
      data: {
        id: id || slug,
        name,
        slug,
        category,
        categoryName,
        badge,
        shortDesc,
        description,
        origin,
        spec,
        ingredients,
        shelfLife,
        featured: Boolean(featured),
        images: JSON.stringify(images || []),
        variants: {
          create: variants || [],
        },
      },
      include: { variants: true },
    });

    res.status(201).json({
      success: true,
      message: 'Thêm sản phẩm mới thành công.',
      data: {
        ...product,
        images: JSON.parse(product.images),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { images, variants, ...rest } = req.body;

    const updateData: any = { ...rest };
    if (images) {
      updateData.images = JSON.stringify(images);
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: { variants: true },
    });

    res.json({
      success: true,
      message: 'Cập nhật sản phẩm thành công.',
      data: {
        ...product,
        images: JSON.parse(product.images),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.product.delete({ where: { id } });
    res.json({ success: true, message: 'Đã xóa sản phẩm.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

