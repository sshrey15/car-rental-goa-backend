import express from "express";
import { protect } from "../middleware/auth.js";
import { approveCar, getAllBookings, getAllCars, getDashboardStats, getAllUsers } from "../controllers/adminController.js";

const adminRouter = express.Router();

// Middleware to check if user is admin
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.json({ success: false, message: "Not authorized as admin" });
    }
};

adminRouter.get('/stats', getDashboardStats);
adminRouter.get('/bookings', getAllBookings);
adminRouter.get('/cars', getAllCars);
adminRouter.get('/users', getAllUsers);
adminRouter.post('/approve-car', approveCar);

export default adminRouter;
