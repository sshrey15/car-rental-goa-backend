import express from "express";
import { 
  createPaymentOrder, 
  verifyPayment, 
  paymentWebhook,
  getRazorpayKey,
  initiateRefund,
  payForBooking
} from "../controllers/paymentController.js";
import { protect } from "../middleware/auth.js";

const paymentRouter = express.Router();

// Get Razorpay key (public)
paymentRouter.get("/key", getRazorpayKey);

// Create payment order (protected)
paymentRouter.post("/create-order", protect, createPaymentOrder);

// Pay for existing booking (protected)
paymentRouter.post("/pay-booking", protect, payForBooking);

// Verify payment (protected)
paymentRouter.post("/verify", protect, verifyPayment);

// Razorpay webhook (no auth, uses webhook signature verification)
paymentRouter.post("/webhook", paymentWebhook);

// Initiate refund (protected - owner/admin only)
paymentRouter.post("/refund", protect, initiateRefund);

export default paymentRouter;
