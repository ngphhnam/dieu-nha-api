import { Router } from 'express';
import authRoutes from './auth.routes.js';
import productRoutes from './product.routes.js';
import orderRoutes from './order.routes.js';
import userRoutes from './user.routes.js';
import settingRoutes from './setting.routes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/orders', orderRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/settings', settingRoutes);

apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Dieu Nha Backend API',
    timestamp: new Date().toISOString(),
  });
});

export default apiRouter;

