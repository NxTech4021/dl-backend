import { Router } from "express";
import {
  getPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  markPaymentAsPaid,
  deletePayment,
  createFiuuCheckout,
  handleFiuuNotification,
  handleFiuuReturn,
} from "../controllers/paymentController";
import { verifyAuth, requireAdmin } from "../middlewares/auth.middleware";

const router = Router();

// Webhook routes - NO auth (called by external payment gateway)
router.post("/fiuu/ipn", handleFiuuNotification);
router.post("/fiuu/return", handleFiuuReturn);
router.get("/fiuu/return", handleFiuuReturn);

// Authenticated routes
router.post("/fiuu/checkout", verifyAuth, createFiuuCheckout);

// Admin-only routes
router.get("/", verifyAuth, requireAdmin, getPayments);
router.get("/:id", verifyAuth, requireAdmin, getPaymentById);
router.post("/", verifyAuth, requireAdmin, createPayment);
router.put("/:id", verifyAuth, requireAdmin, updatePayment);
router.patch("/:id/mark-paid", verifyAuth, requireAdmin, markPaymentAsPaid);
router.delete("/:id", verifyAuth, requireAdmin, deletePayment);

export default router;


