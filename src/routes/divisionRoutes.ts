import { Router } from 'express';
import { 
  getDivisions, 
  getDivisionById, 
  createDivision, 
  updateDivision, 
  deleteDivision 
} from '../controllers/divisionController';

const router = Router();

router.get('/', getDivisions);
router.get('/:id', getDivisionById);
router.post('/', createDivision);
router.put('/:id', updateDivision);
router.delete('/:id', deleteDivision);

export default router;


