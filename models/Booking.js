import mongoose from "mongoose";
const {ObjectId} = mongoose.Schema.Types

const bookingSchema = new mongoose.Schema({
    car: {type: ObjectId, ref: "Car", required: true},
    user: {type: ObjectId, ref: "User", required: true},
    owner: {type: ObjectId, ref: "User", required: true},
    pickupDate: {type: Date, required: true},
    returnDate: {type: Date, required: true},
    status: {type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending"},
    price: {type: Number, required: true},
    originalPrice: {type: Number, required: true},
    discountAmount: {type: Number, default: 0},
    appliedCoupon: {type: ObjectId, ref: "Coupon", default: null},
    amountPaid: {type: Number, default: 0},
    termsAccepted: {type: Boolean, default: true},
    confirmedAt: {type: Date, default: null},
    // Razorpay payment details
    paymentStatus: {type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending"},
    razorpayOrderId: {type: String, default: null},
    razorpayPaymentId: {type: String, default: null},
    razorpaySignature: {type: String, default: null},
    paymentMethod: {type: String, default: null},
    paidAt: {type: Date, default: null},
},{timestamps: true})

const Booking = mongoose.model('Booking', bookingSchema)

export default Booking