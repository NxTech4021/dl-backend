import { Router } from 'express';
import { createCategory, getAllCategories, getCategoryById, updateCategory, deleteCategory } from '../controllers/categoryController';
import { verifyAuth, requireAdmin } from '../middlewares/auth.middleware';

const categoryRoutes = Router();

categoryRoutes.get('/', getAllCategories);
categoryRoutes.get('/:id', getCategoryById);
categoryRoutes.post('/create', verifyAuth, requireAdmin, createCategory);
categoryRoutes.put('/:id', verifyAuth, requireAdmin, updateCategory);
categoryRoutes.delete('/:id', verifyAuth, requireAdmin, deleteCategory);

export default categoryRoutes;
