import Booking from "../models/Booking.js";
import Car from "../models/Car.js";
import Coupon from "../models/Coupon.js";
import PDFDocument from "pdfkit";

// Function to Check Availability of Car for a given Date
const checkAvailability = async (car, pickupDate, returnDate, excludeBookingId = null) => {
  const query = {
    car,
    status: { $in: ["pending", "confirmed"] }, // Only consider pending and confirmed bookings
    pickupDate: { $lte: new Date(returnDate) },
    returnDate: { $gte: new Date(pickupDate) },
  };
  
  // Exclude the current booking if updating
  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }
  
  const bookings = await Booking.find(query);
  return bookings.length === 0;
};

// API to Check Availability of Cars for the given Date and location
export const checkAvailabilityOfCar = async (req, res) => {
  try {
    const { location, pickupDate, returnDate } = req.body;

    // fetch all available cars for the given location
    const cars = await Car.find({ location, isAvaliable: true, isApproved: true })
      .populate("appliedCoupon");

    // check car availability for the given date range using promise
    const availableCarsPromises = cars.map(async (car) => {
      const isAvailable = await checkAvailability(
        car._id,
        pickupDate,
        returnDate,
      );
      return { ...car._doc, isAvailable: isAvailable };
    });

    let availableCars = await Promise.all(availableCarsPromises);
    availableCars = availableCars.filter((car) => car.isAvailable === true);

    res.json({ success: true, availableCars });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const createBooking = async (req, res) => {
  try {
    const { _id } = req.user;
    const { car, pickupDate, returnDate, amountPaid, couponCode } = req.body;

    const isAvailable = await checkAvailability(car, pickupDate, returnDate);
    if (!isAvailable) {
      return res.json({ success: false, message: "Car is not available for the selected dates. Please choose different dates." });
    }

    const carData = await Car.findById(car).populate("appliedCoupon");

    // Calculate price based on pickupDate and returnDate
    const picked = new Date(pickupDate);
    const returned = new Date(returnDate);
    const noOfDays = Math.ceil((returned - picked) / (1000 * 60 * 60 * 24));
    const originalPrice = carData.pricePerDay * noOfDays;
    
    let discountAmount = 0;
    let appliedCoupon = null;
    let finalPrice = originalPrice;

    // Check for coupon - either from car or from user input
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

          // Increment coupon usage
          await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } });
        }
      }
    }

    await Booking.create({
      car,
      owner: carData.owner,
      user: _id,
      pickupDate,
      returnDate,
      price: finalPrice,
      originalPrice,
      discountAmount,
      appliedCoupon,
      amountPaid: amountPaid || 0
    });

    res.json({ 
      success: true, 
      message: "Booking Created",
      bookingDetails: {
        originalPrice,
        discountAmount,
        finalPrice,
        couponApplied: appliedCoupon ? true : false
      }
    });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const getUserBookings = async (req, res) => {
  try {
    const { _id } = req.user;
    const bookings = await Booking.find({ user: _id })
      .populate("car")
      .populate("owner", "name phone email")
      .populate("appliedCoupon")
      .sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// API to get Owner Bookings

export const getOwnerBookings = async (req, res) => {
  try {
    if (req.user.role !== "owner") {
      return res.json({ success: false, message: "Unauthorized" });
    }
    const bookings = await Booking.find({ owner: req.user._id })
      .populate("car user")
      .populate("appliedCoupon")
      .select("-user.password")
      .sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// API to change booking status
export const changeBookingStatus = async (req, res) => {
  try {
    const { _id } = req.user;
    const { bookingId, status } = req.body;

    const booking = await Booking.findById(bookingId)
      .populate("car")
      .populate("user", "name email phone")
      .populate("owner", "name email phone");

    if (booking.owner._id.toString() !== _id.toString()) {
      return res.json({ success: false, message: "Unauthorized" });
    }

    // If confirming, check for overlapping bookings again
    if (status === "confirmed") {
      const isStillAvailable = await checkAvailability(
        booking.car._id, 
        booking.pickupDate, 
        booking.returnDate,
        booking._id
      );
      
      if (!isStillAvailable) {
        return res.json({ 
          success: false, 
          message: "Cannot confirm booking. The car has already been booked for overlapping dates." 
        });
      }
      
      booking.confirmedAt = new Date();
    }

    booking.status = status;
    await booking.save();

    res.json({ success: true, message: "Status Updated", booking });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// API to generate booking PDF
export const generateBookingPDF = async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    const booking = await Booking.findById(bookingId)
      .populate("car")
      .populate("user", "name email phone")
      .populate("owner", "name email phone")
      .populate("appliedCoupon");

    if (!booking) {
      return res.json({ success: false, message: "Booking not found" });
    }

    // Allow PDF generation for confirmed bookings OR paid bookings
    if (booking.status !== "confirmed" && booking.paymentStatus !== "paid") {
      return res.json({ success: false, message: "PDF can only be generated for confirmed or paid bookings" });
    }

    // Check authorization
    const userId = req.user._id.toString();
    if (booking.user._id.toString() !== userId && booking.owner._id.toString() !== userId) {
      return res.json({ success: false, message: "Unauthorized" });
    }

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=booking-${bookingId}.pdf`);
    
    doc.pipe(res);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('Car Rental Goa', { align: 'center' });
    doc.fontSize(14).font('Helvetica').text('Booking Confirmation', { align: 'center' });
    doc.moveDown(2);

    // Booking Details
    doc.fontSize(16).font('Helvetica-Bold').text('Booking Details');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica');
    doc.text(`Booking ID: ${booking._id}`);
    doc.text(`Booking Date: ${new Date(booking.createdAt).toLocaleDateString()}`);
    doc.text(`Confirmed Date: ${booking.confirmedAt ? new Date(booking.confirmedAt).toLocaleDateString() : 'N/A'}`);
    doc.text(`Status: ${booking.status.toUpperCase()}`);
    doc.moveDown();

    // Vehicle Details
    doc.fontSize(16).font('Helvetica-Bold').text('Vehicle Details');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica');
    doc.text(`Vehicle: ${booking.car.brand} ${booking.car.model} (${booking.car.year})`);
    doc.text(`Category: ${booking.car.category}`);
    doc.text(`Transmission: ${booking.car.transmission}`);
    doc.text(`Fuel Type: ${booking.car.fuel_type}`);
    doc.text(`Seating Capacity: ${booking.car.seating_capacity}`);
    doc.text(`Pickup Location: ${booking.car.location}`);
    doc.moveDown();

    // Rental Period
    doc.fontSize(16).font('Helvetica-Bold').text('Rental Period');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica');
    const pickupDate = new Date(booking.pickupDate);
    const returnDate = new Date(booking.returnDate);
    const days = Math.ceil((returnDate - pickupDate) / (1000 * 60 * 60 * 24));
    
    doc.text(`Pickup Date: ${pickupDate.toLocaleDateString()}`);
    doc.text(`Return Date: ${returnDate.toLocaleDateString()}`);
    doc.text(`Duration: ${days} day(s)`);
    doc.moveDown();

    // Price Details
    doc.fontSize(16).font('Helvetica-Bold').text('Price Details');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica');
    doc.text(`Daily Rate: ₹${booking.car.pricePerDay}`);
    doc.text(`Original Price: ₹${booking.originalPrice}`);
    if (booking.discountAmount > 0) {
      doc.text(`Discount: -₹${booking.discountAmount}${booking.appliedCoupon ? ` (Coupon: ${booking.appliedCoupon.code})` : ''}`);
    }
    doc.font('Helvetica-Bold').text(`Total Amount: ₹${booking.price}`);
    doc.font('Helvetica').text(`Amount Paid: ₹${booking.amountPaid}`);
    if (booking.price > booking.amountPaid) {
      doc.text(`Balance Due: ₹${booking.price - booking.amountPaid}`);
    }
    doc.moveDown();

    // Payment Details
    if (booking.razorpayPaymentId) {
      doc.fontSize(16).font('Helvetica-Bold').text('Payment Details');
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fontSize(11).font('Helvetica');
      doc.text(`Payment ID: ${booking.razorpayPaymentId}`);
      doc.text(`Payment Status: ${booking.paymentStatus?.toUpperCase() || 'PAID'}`);
      if (booking.paymentMethod) {
        doc.text(`Payment Method: ${booking.paymentMethod.toUpperCase()}`);
      }
      if (booking.paidAt) {
        doc.text(`Payment Date: ${new Date(booking.paidAt).toLocaleString()}`);
      }
      doc.moveDown();
    }

    // Customer Details
    doc.fontSize(16).font('Helvetica-Bold').text('Customer Details');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica');
    doc.text(`Name: ${booking.user.name}`);
    doc.text(`Email: ${booking.user.email}`);
    doc.text(`Phone: ${booking.user.phone}`);
    doc.moveDown();

    // Owner Details
    doc.fontSize(16).font('Helvetica-Bold').text('Vehicle Owner Details');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica');
    doc.text(`Name: ${booking.owner.name}`);
    doc.text(`Email: ${booking.owner.email}`);
    doc.text(`Phone: ${booking.owner.phone}`);
    doc.moveDown(2);

    // Terms and Conditions
    doc.fontSize(16).font('Helvetica-Bold').text('Terms and Conditions');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    doc.fontSize(9).font('Helvetica');
    const terms = [
      '1. The renter must possess a valid driving license and be at least 21 years of age.',
      '2. The vehicle must be returned in the same condition as it was rented.',
      '3. Any damage to the vehicle during the rental period is the responsibility of the renter.',
      '4. Fuel charges are not included. The vehicle must be returned with the same fuel level.',
      '5. Late returns may incur additional charges at the daily rate.',
      '6. The vehicle must not be used for illegal activities or taken outside permitted areas.',
      '7. In case of an accident, the renter must immediately inform the owner and local authorities.',
      '8. Cancellation charges may apply as per the cancellation policy.',
      '9. The renter agrees to pay for any traffic violations during the rental period.',
      '10. By accepting this booking, the renter agrees to all terms and conditions.',
    ];

    terms.forEach(term => {
      doc.text(term);
    });

    doc.moveDown();
    doc.fontSize(9).font('Helvetica-Oblique');
    doc.text('For complete terms and conditions, please visit our website.', { align: 'center' });
    
    doc.moveDown(2);
    doc.fontSize(10).font('Helvetica').text('This is a computer-generated document. No signature required.', { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });

    doc.end();
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// API to get a single booking details
export const getBookingDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    const booking = await Booking.findById(bookingId)
      .populate("car")
      .populate("user", "name email phone")
      .populate("owner", "name email phone")
      .populate("appliedCoupon");

    if (!booking) {
      return res.json({ success: false, message: "Booking not found" });
    }

    // Check authorization
    const userId = req.user._id.toString();
    if (booking.user._id.toString() !== userId && booking.owner._id.toString() !== userId) {
      return res.json({ success: false, message: "Unauthorized" });
    }

    res.json({ success: true, booking });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};
