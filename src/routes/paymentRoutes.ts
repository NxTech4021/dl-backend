import { Router } from 'express';
import { 
  getPayments, 
  getPaymentById, 
  createPayment, 
  updatePayment, 
  markPaymentAsPaid,
  deletePayment 
} from '../controllers/paymentController';

const router = Router();

router.get('/', getPayments);
router.get('/:id', getPaymentById);
router.post('/', createPayment);
router.put('/:id', updatePayment);
router.patch('/:id/mark-paid', markPaymentAsPaid);
router.delete('/:id', deletePayment);

export default router;


