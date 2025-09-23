import { Router } from 'express';
import {
  createPayment,
  paymentReturn,
  paymentNotify,
  getPaymentStatus,
  getUserPayments
} from '../controllers/paymentController';
import { verifyAuth } from '../middlewares/auth.middleware';

const router = Router();

// Protected routes (require authentication) - temporarily disabled for testing
router.post('/create', createPayment); // TODO: Re-enable verifyAuth after frontend auth is fixed
router.get('/status/:orderId', getPaymentStatus); // TODO: Re-enable verifyAuth after frontend auth is fixed
router.get('/user', getUserPayments); // TODO: Re-enable verifyAuth after frontend auth is fixed

// Public routes (for payment gateway callbacks)
router.get('/return', paymentReturn);
router.post('/notify', paymentNotify);

export default router;