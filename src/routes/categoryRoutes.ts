import { Router } from 'express';
import { createCategory, getCategoriesByLeague, updateCategory, deleteCategory } from '../controllers/categoryController';

const categoryRoutes = Router();


categoryRoutes.post('/create', createCategory);
categoryRoutes.get('/league/:leagueId', getCategoriesByLeague);
categoryRoutes.put('/:id', updateCategory);
categoryRoutes.delete('/:id', deleteCategory);

export default categoryRoutes;
