import Razorpay from "razorpay";
import crypto from "crypto";
import Booking from "../models/Booking.js";
import Car from "../models/Car.js";
import Coupon from "../models/Coupon.js";

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Function to Check Availability of Car for a given Date
const checkAvailability = async (car, pickupDate, returnDate, excludeBookingId = null) => {
  const query = {
    car,
    status: { $in: ["pending", "confirmed"] },
    pickupDate: { $lte: new Date(returnDate) },
    returnDate: { $gte: new Date(pickupDate) },
  };
  
  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }
  
  const bookings = await Booking.find(query);
  return bookings.length === 0;
};

// Create Razorpay Order and Booking
export const createPaymentOrder = async (req, res) => {
  try {
    const { _id } = req.user;
    const { car, pickupDate, returnDate, couponCode, payPartial } = req.body;

    // Check car availability
    const isAvailable = await checkAvailability(car, pickupDate, returnDate);
    if (!isAvailable) {
      return res.json({ 
        success: false, 
        message: "Car is not available for the selected dates. Please choose different dates." 
      });
    }

    const carData = await Car.findById(car).populate("appliedCoupon");
    if (!carData) {
      return res.json({ success: false, message: "Car not found" });
    }

    // Calculate price
    const picked = new Date(pickupDate);
    const returned = new Date(returnDate);
    const noOfDays = Math.ceil((returned - picked) / (1000 * 60 * 60 * 24));
    
    if (noOfDays <= 0) {
      return res.json({ success: false, message: "Invalid date range" });
    }

    const originalPrice = carData.pricePerDay * noOfDays;
    
    let discountAmount = 0;
    let appliedCoupon = null;
    let finalPrice = originalPrice;

    // Check for coupon
    let coupon = carData.appliedCoupon;
    
    if (couponCode) {
      const userCoupon = await Coupon.findOne({ 
        code: couponCode.toUpperCase(),
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() }
      });
      
      if (userCoupon) {
        if (userCoupon.usageLimit && userCoupon.usedCount >= userCoupon.usageLimit) {
          return res.json({ success: false, message: "Coupon usage limit reached" });
        }
        coupon = userCoupon;
      }
    }

    // Apply coupon discount if available
    if (coupon && coupon.isActive) {
      const now = new Date();
      if (now >= coupon.validFrom && now <= coupon.validUntil) {
        if (originalPrice >= coupon.minBookingAmount) {
          if (coupon.discountType === "percentage") {
            discountAmount = (originalPrice * coupon.discountValue) / 100;
            if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
              discountAmount = coupon.maxDiscount;
            }
          } else {
            discountAmount = coupon.discountValue;
          }
          
          finalPrice = originalPrice - discountAmount;
          if (finalPrice < 0) finalPrice = 0;
          appliedCoupon = coupon._id;
        }
      }
    }

    // Calculate amount to pay (full or 50% advance)
    const amountToPay = payPartial ? Math.ceil(finalPrice / 2) : finalPrice;

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: amountToPay * 100, // Razorpay expects amount in paise
      currency: "INR",
      receipt: `booking_${Date.now()}`,
      notes: {
        carId: car,
        userId: _id.toString(),
        pickupDate,
        returnDate,
      },
    });

    // Create booking with pending payment status
    const booking = await Booking.create({
      car,
      owner: carData.owner,
      user: _id,
      pickupDate,
      returnDate,
      price: finalPrice,
      originalPrice,
      discountAmount,
      appliedCoupon,
      amountPaid: 0,
      paymentStatus: "pending",
      razorpayOrderId: razorpayOrder.id,
    });

    res.json({
      success: true,
      orderId: razorpayOrder.id,
      bookingId: booking._id,
      amount: amountToPay,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      bookingDetails: {
        originalPrice,
        discountAmount,
        finalPrice,
        amountToPay,
        couponApplied: appliedCoupon ? true : false,
      },
    });
  } catch (error) {
    console.log("Payment order error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// Verify Payment after Razorpay callback
export const verifyPayment = async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature, 
      bookingId 
    } = req.body;

    // Verify signature
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      // Update booking as failed
      await Booking.findByIdAndUpdate(bookingId, {
        paymentStatus: "failed",
      });
      return res.json({ success: false, message: "Invalid payment signature" });
    }

    // Get payment details from Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    // Update booking with payment details
    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      {
        paymentStatus: "paid",
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        amountPaid: payment.amount / 100, // Convert from paise
        paymentMethod: payment.method,
        paidAt: new Date(),
      },
      { new: true }
    ).populate("car")
      .populate("user", "name email phone")
      .populate("owner", "name email phone")
      .populate("appliedCoupon");

    // Increment coupon usage if applied
    if (booking.appliedCoupon) {
      await Coupon.findByIdAndUpdate(booking.appliedCoupon._id, { $inc: { usedCount: 1 } });
    }

    res.json({
      success: true,
      message: "Payment verified successfully",
      booking,
    });
  } catch (error) {
    console.log("Payment verification error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// Razorpay Webhook handler
export const paymentWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    // Verify webhook signature
    const signature = req.headers["x-razorpay-signature"];
    const shasum = crypto.createHmac("sha256", webhookSecret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest("hex");

    if (signature !== digest) {
      return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    switch (event) {
      case "payment.captured":
        const paymentEntity = payload.payment.entity;
        const orderId = paymentEntity.order_id;
        
        // Update booking
        await Booking.findOneAndUpdate(
          { razorpayOrderId: orderId },
          {
            paymentStatus: "paid",
            razorpayPaymentId: paymentEntity.id,
            amountPaid: paymentEntity.amount / 100,
            paymentMethod: paymentEntity.method,
            paidAt: new Date(),
          }
        );
        break;

      case "payment.failed":
        const failedPayment = payload.payment.entity;
        await Booking.findOneAndUpdate(
          { razorpayOrderId: failedPayment.order_id },
          { paymentStatus: "failed" }
        );
        break;

      case "refund.created":
        const refundEntity = payload.refund.entity;
        await Booking.findOneAndUpdate(
          { razorpayPaymentId: refundEntity.payment_id },
          { paymentStatus: "refunded" }
        );
        break;
    }

    res.json({ success: true });
  } catch (error) {
    console.log("Webhook error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Razorpay Key (for frontend)
export const getRazorpayKey = async (req, res) => {
  res.json({
    success: true,
    keyId: process.env.RAZORPAY_KEY_ID,
  });
};

// Initiate Refund
export const initiateRefund = async (req, res) => {
  try {
    const { bookingId } = req.body;
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.json({ success: false, message: "Booking not found" });
    }

    // Check authorization (only owner or admin can initiate refund)
    if (booking.owner.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.json({ success: false, message: "Unauthorized" });
    }

    if (!booking.razorpayPaymentId) {
      return res.json({ success: false, message: "No payment found to refund" });
    }

    if (booking.paymentStatus === "refunded") {
      return res.json({ success: false, message: "Payment already refunded" });
    }

    // Create refund
    const refund = await razorpay.payments.refund(booking.razorpayPaymentId, {
      amount: booking.amountPaid * 100, // Full refund in paise
      speed: "normal",
      notes: {
        reason: "Booking cancelled",
        bookingId: bookingId,
      },
    });

    // Update booking
    booking.paymentStatus = "refunded";
    booking.status = "cancelled";
    await booking.save();

    res.json({
      success: true,
      message: "Refund initiated successfully",
      refundId: refund.id,
    });
  } catch (error) {
    console.log("Refund error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// Pay for existing booking (remaining balance or full payment for unpaid bookings)
export const payForBooking = async (req, res) => {
  try {
    const { _id } = req.user;
    const { bookingId, payFull } = req.body;

    const booking = await Booking.findById(bookingId).populate("car");
    if (!booking) {
      return res.json({ success: false, message: "Booking not found" });
    }

    // Verify the booking belongs to this user
    if (booking.user.toString() !== _id.toString()) {
      return res.json({ success: false, message: "Unauthorized" });
    }

    // Check if booking is already fully paid
    if (booking.paymentStatus === "paid" && booking.amountPaid >= booking.price) {
      return res.json({ success: false, message: "Booking is already fully paid" });
    }

    // Check if booking is cancelled or refunded
    if (booking.status === "cancelled" || booking.paymentStatus === "refunded") {
      return res.json({ success: false, message: "Cannot pay for cancelled booking" });
    }

    // Calculate amount to pay
    const remainingAmount = booking.price - (booking.amountPaid || 0);
    const amountToPay = payFull ? remainingAmount : Math.ceil(remainingAmount / 2);

    if (amountToPay <= 0) {
      return res.json({ success: false, message: "No payment required" });
    }

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: amountToPay * 100, // Razorpay expects amount in paise
      currency: "INR",
      receipt: `booking_pay_${Date.now()}`,
      notes: {
        bookingId: bookingId,
        userId: _id.toString(),
        paymentType: "remaining_balance",
      },
    });

    // Update booking with new order ID
    booking.razorpayOrderId = razorpayOrder.id;
    await booking.save();

    res.json({
      success: true,
      orderId: razorpayOrder.id,
      bookingId: booking._id,
      amount: amountToPay,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      bookingDetails: {
        totalPrice: booking.price,
        alreadyPaid: booking.amountPaid || 0,
        remainingAmount,
        amountToPay,
      },
    });
  } catch (error) {
    console.log("Pay for booking error:", error.message);
    res.json({ success: false, message: error.message });
  }
};
