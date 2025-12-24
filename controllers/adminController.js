import Booking from "../models/Booking.js";
import Car from "../models/Car.js";
import User from "../models/User.js";
import Coupon from "../models/Coupon.js";
import Location from "../models/Location.js";


export const getDashboardStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ role: "user" });
        const totalOwners = await User.countDocuments({ role: "owner" });
        const totalCars = await Car.countDocuments({});
        const totalBookings = await Booking.countDocuments({});
        const pendingApprovals = await Car.countDocuments({ isApproved: false });
        const totalCoupons = await Coupon.countDocuments({});
        const totalLocations = await Location.countDocuments({});

        res.json({
            success: true,
            stats: {
                totalUsers,
                totalOwners,
                totalCars,
                totalBookings,
                pendingApprovals,
                totalCoupons,
                totalLocations
            }
        });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

export const getAllBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({})
            .populate("user", "name email phone")
            .populate("car", "brand model image")
            .populate("owner", "name email phone")
            .sort({ createdAt: -1 });
        res.json({ success: true, bookings });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};


export const getAllCars = async (req, res) => {
    try {
        const { location } = req.query;
        let filter = {};
        
        if (location && location !== 'all') {
            filter.location = location;
        }
        
        const cars = await Car.find(filter)
            .populate("owner", "name email phone")
            .populate("appliedCoupon")
            .sort({ createdAt: -1 });
        res.json({ success: true, cars });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};


export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).sort({ createdAt: -1 });
        res.json({ success: true, users });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};


export const approveCar = async (req, res) => {
    try {
        const { carId, isApproved } = req.body;
        const car = await Car.findByIdAndUpdate(carId, { isApproved }, { new: true });
        
        if (!car) {
            return res.json({ success: false, message: "Car not found" });
        }

        res.json({ success: true, message: isApproved ? "Car Approved" : "Car Unapproved", car });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// ========== COUPON MANAGEMENT ==========

export const createCoupon = async (req, res) => {
    try {
        const { code, description, discountType, discountValue, minBookingAmount, maxDiscount, validFrom, validUntil, usageLimit } = req.body;
        
        if (!code || !description || !discountType || !discountValue || !validFrom || !validUntil) {
            return res.json({ success: false, message: "Please fill all required fields" });
        }

        const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (existingCoupon) {
            return res.json({ success: false, message: "Coupon code already exists" });
        }

        const coupon = await Coupon.create({
            code: code.toUpperCase(),
            description,
            discountType,
            discountValue,
            minBookingAmount: minBookingAmount || 0,
            maxDiscount: maxDiscount || null,
            validFrom,
            validUntil,
            usageLimit: usageLimit || null
        });

        res.json({ success: true, message: "Coupon created successfully", coupon });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

export const getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find({}).sort({ createdAt: -1 });
        res.json({ success: true, coupons });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

export const getActiveCoupons = async (req, res) => {
    try {
        const now = new Date();
        const coupons = await Coupon.find({
            isActive: true,
            validFrom: { $lte: now },
            validUntil: { $gte: now },
            $or: [
                { usageLimit: null },
                { $expr: { $lt: ["$usedCount", "$usageLimit"] } }
            ]
        }).sort({ createdAt: -1 });
        res.json({ success: true, coupons });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

export const updateCoupon = async (req, res) => {
    try {
        const { couponId, ...updateData } = req.body;
        
        const coupon = await Coupon.findByIdAndUpdate(couponId, updateData, { new: true });
        
        if (!coupon) {
            return res.json({ success: false, message: "Coupon not found" });
        }

        res.json({ success: true, message: "Coupon updated successfully", coupon });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

export const deleteCoupon = async (req, res) => {
    try {
        const { couponId } = req.body;
        
        const coupon = await Coupon.findByIdAndDelete(couponId);
        
        if (!coupon) {
            return res.json({ success: false, message: "Coupon not found" });
        }

        res.json({ success: true, message: "Coupon deleted successfully" });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

export const toggleCouponStatus = async (req, res) => {
    try {
        const { couponId } = req.body;
        
        const coupon = await Coupon.findById(couponId);
        
        if (!coupon) {
            return res.json({ success: false, message: "Coupon not found" });
        }

        coupon.isActive = !coupon.isActive;
        await coupon.save();

        res.json({ success: true, message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`, coupon });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// ========== LOCATION MANAGEMENT ==========

export const createLocation = async (req, res) => {
    try {
        const { name, description } = req.body;
        
        if (!name) {
            return res.json({ success: false, message: "Location name is required" });
        }

        const existingLocation = await Location.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existingLocation) {
            return res.json({ success: false, message: "Location already exists" });
        }

        const location = await Location.create({ name, description });

        res.json({ success: true, message: "Location created successfully", location });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

export const getAllLocations = async (req, res) => {
    try {
        const locations = await Location.find({}).sort({ name: 1 });
        res.json({ success: true, locations });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

export const getActiveLocations = async (req, res) => {
    try {
        const locations = await Location.find({ isActive: true }).sort({ name: 1 });
        res.json({ success: true, locations });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

export const updateLocation = async (req, res) => {
    try {
        const { locationId, name, description } = req.body;
        
        const location = await Location.findByIdAndUpdate(
            locationId, 
            { name, description }, 
            { new: true }
        );
        
        if (!location) {
            return res.json({ success: false, message: "Location not found" });
        }

        res.json({ success: true, message: "Location updated successfully", location });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

export const deleteLocation = async (req, res) => {
    try {
        const { locationId } = req.body;
        
        // Check if any cars are using this location
        const carsUsingLocation = await Car.countDocuments({ location: locationId });
        if (carsUsingLocation > 0) {
            return res.json({ success: false, message: "Cannot delete location. Some cars are using it." });
        }

        const location = await Location.findByIdAndDelete(locationId);
        
        if (!location) {
            return res.json({ success: false, message: "Location not found" });
        }

        res.json({ success: true, message: "Location deleted successfully" });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

export const toggleLocationStatus = async (req, res) => {
    try {
        const { locationId } = req.body;
        
        const location = await Location.findById(locationId);
        
        if (!location) {
            return res.json({ success: false, message: "Location not found" });
        }

        location.isActive = !location.isActive;
        await location.save();

        res.json({ success: true, message: `Location ${location.isActive ? 'activated' : 'deactivated'} successfully`, location });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};
