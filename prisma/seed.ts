import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEED_PRODUCTS = [
  {
    id: 'dieu-rang-muoi-a-plus',
    name: 'Hạt Điều Rang Muối Vỏ Lụa Phước Long (Loại 1 Cồ A+)',
    slug: 'hat-dieu-rang-muoi-vo-lua-phuoc-long',
    category: 'rang-muoi',
    categoryName: 'Hạt điều rang muối',
    badge: 'Bán chạy nhất',
    rating: 4.9,
    reviewsCount: 428,
    soldCount: 5240,
    shortDesc: 'Hạt to đều tăm tắp chuẩn W240, rang củi thủ công giữ nguyên độ béo ngậy, bùi giòn ngọt hậu đậm vị đất đỏ Phước Long.',
    description: 'Hạt điều rang muối vỏ lụa Điều Nhà được thu hái từ những cây điều cổ thụ đất đỏ Phước Long, Bình Phước. Áp dụng phương pháp rang củi cà phê truyền thống với tỷ lệ muối hạt chỉ 1%, lớp vỏ lụa mỏng giúp nhân hạt không bị cháy sém, giữ trọn độ giòn rụm và vị ngọt béo tự nhiên.',
    origin: 'Thị xã Phước Long, Bình Phước',
    spec: 'Chuẩn xuất khẩu W240 (240 hạt/pound, hạt cồ to đều)',
    ingredients: '99% hạt điều Phước Long tuyển chọn, 1% muối tinh khiết',
    shelfLife: '12 tháng (kể từ ngày đóng gói in trên nắp)',
    images: JSON.stringify([
      '/images/cashew-salted-hucao.jpg',
      '/images/cashew-salted-tuizip.jpg',
      '/images/cashew-salted-hoptron.jpg',
    ]),
    featured: true,
    variants: [
      { id: 'rm-hucao', weight: 'Hũ cao', price: 170000, originalPrice: 210000, inStock: true, image: '/images/cashew-salted-hucao.jpg' },
      { id: 'rm-tuizip', weight: 'Túi Zip', price: 170000, originalPrice: 210000, inStock: true, image: '/images/cashew-salted-tuizip.jpg' },
      { id: 'rm-hoptron', weight: 'Hộp tròn', price: 130000, originalPrice: 160000, inStock: true, image: '/images/cashew-salted-hoptron.jpg' },
    ],
  },
  {
    id: 'dieu-tach-vo-say-moc',
    name: 'Hạt Điều Sấy Mộc Tách Vỏ (100% Không Muối Nguyên Vị)',
    slug: 'hat-dieu-say-moc-tach-vo-khong-muoi',
    category: 'tach-vo',
    categoryName: 'Hạt điều sấy mộc',
    badge: 'Eat Clean & Gym',
    rating: 4.8,
    reviewsCount: 265,
    soldCount: 3120,
    shortDesc: 'Đã bóc sạch vỏ lụa, sấy nhiệt thấp giữ trọn dinh dưỡng. Lựa chọn số 1 cho người ăn kiêng, tập gym, bà bầu.',
    description: 'Dành riêng cho những ai theo đuổi lối sống Eat Clean, giảm muối bảo vệ tim mạch và huyết áp. Hạt điều Phước Long được bóc sạch vỏ lụa, sấy chín ở nhiệt độ chuẩn 80°C. Vị thơm bùi tự nhiên từ nhân hạt, không dầu chiên, không phụ gia.',
    origin: 'Phước Long, Bình Phước',
    spec: 'Hạt nguyên size W210 cao cấp (hạt đại)',
    ingredients: '100% nhân hạt điều tự nhiên sấy mộc',
    shelfLife: '9 tháng ở nhiệt độ thoáng mát',
    images: JSON.stringify([
      '/images/cashew-peeled-hucao.jpg',
      '/images/cashew-peeled-tuizip.jpg',
      '/images/cashew-peeled-hoptron.jpg',
    ]),
    featured: true,
    variants: [
      { id: 'sm-hucao', weight: 'Hũ cao', price: 185000, originalPrice: 230000, inStock: true, image: '/images/cashew-peeled-hucao.jpg' },
      { id: 'sm-tuizip', weight: 'Túi Zip', price: 185000, originalPrice: 230000, inStock: true, image: '/images/cashew-peeled-tuizip.jpg' },
      { id: 'sm-hoptron', weight: 'Hộp tròn', price: 145000, originalPrice: 180000, inStock: true, image: '/images/cashew-peeled-hoptron.jpg' },
    ],
  },
  {
    id: 'dieu-chay-toi-ot',
    name: 'Hạt Điều Cháy Tỏi Ớt Lá Chanh Cay Giòn Rụm',
    slug: 'hat-dieu-chay-toi-ot-la-chanh',
    category: 'che-bien',
    categoryName: 'Vị tỏi ớt & Mật ong',
    badge: 'Ăn vặt đỉnh cao',
    rating: 4.9,
    reviewsCount: 198,
    soldCount: 2450,
    shortDesc: 'Hòa quyện giữa tỏi phi vàng ươm, ớt hiểm tươi cay tê và lá chanh sấy thơm nức mũi.',
    description: 'Từng hạt điều tròn mẩy Phước Long được áo một lớp sốt tỏi ớt mắm nhĩ vàng óng, quyện cùng lá chanh bánh tẻ sấy khô giòn tan. Hương vị cay mặn ngọt đậm đà, ăn là ghiền.',
    origin: 'Phước Long, Bình Phước',
    spec: 'Hạt nguyên và hạt vỡ đôi áo sốt đặc biệt',
    ingredients: 'Hạt điều (88%), tỏi củ (5%), ớt tươi, lá chanh, nước mắm nhĩ cốt, đường mía tự nhiên',
    shelfLife: '6 tháng',
    images: JSON.stringify([
      '/images/cashew-garlic-hucao.jpg',
      '/images/cashew-garlic-tuizip.jpg',
      '/images/cashew-garlic-hoptron.jpg',
    ]),
    featured: true,
    variants: [
      { id: 'to-hucao', weight: 'Hũ cao', price: 180000, originalPrice: 220000, inStock: true, image: '/images/cashew-garlic-hucao.jpg' },
      { id: 'to-tuizip', weight: 'Túi Zip', price: 180000, originalPrice: 220000, inStock: true, image: '/images/cashew-garlic-tuizip.jpg' },
      { id: 'to-hoptron', weight: 'Hộp tròn', price: 140000, originalPrice: 170000, inStock: true, image: '/images/cashew-garlic-hoptron.jpg' },
    ],
  },
  {
    id: 'dieu-tam-mat-ong-rung',
    name: 'Hạt Điều Tẩm Mật Ong Rừng & Hoa Cà Phê',
    slug: 'hat-dieu-tam-mat-ong-hoa-ca-phe',
    category: 'che-bien',
    categoryName: 'Vị tỏi ớt & Mật ong',
    badge: 'Món quà ngọt ngào',
    rating: 4.9,
    reviewsCount: 156,
    soldCount: 1890,
    shortDesc: 'Vị ngọt thanh dịu từ mật ong hoa cà phê Bình Phước phủ đều hạt điều giòn béo.',
    description: 'Sự kết hợp hoàn hảo giữa nông sản trứ danh Bình Phước: mật ong rừng nguyên chất thu hái vụ hoa cà phê nở trắng đồi và nhân hạt điều tươi loại 1.',
    origin: 'Phước Long, Bình Phước',
    spec: 'Hạt nguyên size W240 áo lớp caramel mật ong',
    ingredients: 'Hạt điều (85%), mật ong hoa cà phê nguyên chất (12%), muối hồng Himalaya',
    shelfLife: '9 tháng',
    images: JSON.stringify([
      '/images/cashew-honey-hucao.jpg',
      '/images/cashew-honey-tuizip.jpg',
      '/images/cashew-honey-hoptron.jpg',
    ]),
    featured: false,
    variants: [
      { id: 'mo-hucao', weight: 'Hũ cao', price: 195000, originalPrice: 240000, inStock: true, image: '/images/cashew-honey-hucao.jpg' },
      { id: 'mo-tuizip', weight: 'Túi Zip', price: 195000, originalPrice: 240000, inStock: true, image: '/images/cashew-honey-tuizip.jpg' },
      { id: 'mo-hoptron', weight: 'Hộp tròn', price: 155000, originalPrice: 190000, inStock: true, image: '/images/cashew-honey-hoptron.jpg' },
    ],
  },
  {
    id: 'dieu-nhan-trang-nau-sua',
    name: 'Hạt Điều Tươi Nhân Trắng Nấu Sữa & Làm Bánh (Hút Chân Không)',
    slug: 'hat-dieu-tuoi-nhan-trang-nau-sua-hat',
    category: 'tuoi-sua',
    categoryName: 'Hạt điều tươi nấu sữa',
    badge: 'Dành cho mẹ & bé',
    rating: 4.8,
    reviewsCount: 312,
    soldCount: 4100,
    shortDesc: 'Nhân điều tươi sống bóc vỏ lụa, ngọt sữa tự nhiên, giàu dinh dưỡng cho gia đình.',
    description: 'Hạt điều tươi nhân trắng vụ mới nhất, được sơ chế bóc vỏ lụa sạch sẽ và hút chân không bảo quản tiệt trùng. Không hóa chất tẩy trắng.',
    origin: 'Bù Đăng & Phước Long, Bình Phước',
    spec: 'Hạt vỡ mầm tự nhiên chuẩn làm sữa hạt',
    ingredients: '100% nhân điều trắng tươi nguyên chất',
    shelfLife: '6 tháng ở ngăn mát, 12 tháng ở ngăn đông',
    images: JSON.stringify([
      '/images/cashew-fresh-milk.jpg',
    ]),
    featured: false,
    variants: [
      { id: 'ns-500g', weight: 'Túi 500g', price: 165000, originalPrice: 195000, inStock: true, image: '/images/cashew-fresh-milk.jpg' },
      { id: 'ns-1kg', weight: 'Túi 1kg (Hút chân không)', price: 310000, originalPrice: 380000, inStock: true, image: '/images/cashew-fresh-milk.jpg' },
    ],
  },
  {
    id: 'set-qua-bieu-hoang-kim',
    name: 'Hộp Quà Biếu Tết Thượng Hạng Điều Nhà (Hộp Gỗ Mỹ Nghệ)',
    slug: 'hop-qua-bieu-tet-thuong-hang-dieu-nha',
    category: 'hop-qua',
    categoryName: 'Hộp quà biếu Tết',
    badge: 'Sang trọng & Tinh tế',
    rating: 5.0,
    reviewsCount: 89,
    soldCount: 920,
    shortDesc: 'Bộ quà tặng 4 hũ lục giác cao cấp đặt trong hộp gỗ thông khắc laser tinh xảo.',
    description: 'Set quà biếu Tết cao cấp thay lời chúc thịnh vượng, an khang. Bao gồm: 1 hũ Rang muối vỏ lụa Cồ A+, 1 hũ Sấy mộc tách vỏ Eat Clean, 1 hũ Cháy tỏi ớt lá chanh, 1 hũ Tẩm mật ong hoa cà phê.',
    origin: 'Phước Long, Bình Phước',
    spec: 'Set 4 hũ lục giác nắp nhôm vàng + Hộp gỗ quai xách lụa',
    ingredients: 'Tuyển chọn các vị hạt điều thượng hạng nhất của Điều Nhà',
    shelfLife: '12 tháng',
    images: JSON.stringify([
      '/images/cashew-gift-box.jpg',
    ]),
    featured: true,
    variants: [
      { id: 'set-4hu', weight: 'Set 4 hũ (1kg hạt)', price: 580000, originalPrice: 680000, inStock: true, image: '/images/cashew-gift-box.jpg' },
      { id: 'set-6hu', weight: 'Set Hoàng Kim 6 hũ (1.5kg)', price: 850000, originalPrice: 990000, inStock: true, image: '/images/cashew-gift-box.jpg' },
    ],
  },
];

async function main() {
  console.log('Seeding products & admin into Supabase...');

  // 1. Admin
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@dieunha.vn' },
    update: { role: 'ADMIN' },
    create: {
      email: 'admin@dieunha.vn',
      name: 'Quản Trị Viên',
      password: hashedPassword,
      phone: '0968234567',
      role: 'ADMIN',
      tier: 'Admin',
    },
  });

  // 2. Products
  for (const prod of SEED_PRODUCTS) {
    const { variants, ...prodData } = prod;
    await prisma.product.upsert({
      where: { id: prod.id },
      update: {
        ...prodData,
      },
      create: {
        ...prodData,
        variants: {
          create: variants,
        },
      },
    });
  }

  console.log(`Successfully seeded ${SEED_PRODUCTS.length} products to Supabase.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
