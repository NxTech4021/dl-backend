import { Router } from 'express';
import { createCategory, getAllCategories, getCategoryById, getCategoriesByLeague, updateCategory, deleteCategory } from '../controllers/categoryController';

const categoryRoutes = Router();

categoryRoutes.get('/', getAllCategories);
categoryRoutes.get('/:id', getCategoryById);
categoryRoutes.post('/create', createCategory);
categoryRoutes.get('/league/:leagueId', getCategoriesByLeague);
categoryRoutes.put('/:id', updateCategory);
categoryRoutes.delete('/:id', deleteCategory);

export default categoryRoutes;
