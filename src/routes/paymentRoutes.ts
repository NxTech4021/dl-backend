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

const router = Router();

router.post("/fiuu/checkout", createFiuuCheckout);
router.post("/fiuu/ipn", handleFiuuNotification);
router.post("/fiuu/return", handleFiuuReturn);
router.get("/fiuu/return", handleFiuuReturn);

router.get("/", getPayments);
router.get("/:id", getPaymentById);
router.post("/", createPayment);
router.put("/:id", updatePayment);
router.patch("/:id/mark-paid", markPaymentAsPaid);
router.delete("/:id", deletePayment);

export default router;


