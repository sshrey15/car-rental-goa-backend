import Booking from "../models/Booking.js";
import Car from "../models/Car.js";
import User from "../models/User.js";


export const getDashboardStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ role: "user" });
        const totalOwners = await User.countDocuments({ role: "owner" });
        const totalCars = await Car.countDocuments({});
        const totalBookings = await Booking.countDocuments({});
        const pendingApprovals = await Car.countDocuments({ isApproved: false });

        res.json({
            success: true,
            stats: {
                totalUsers,
                totalOwners,
                totalCars,
                totalBookings,
                pendingApprovals
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
        const cars = await Car.find({})
            .populate("owner", "name email phone")
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
