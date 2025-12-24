import express from "express";
import { protect } from "../middleware/auth.js";
import { 
    approveCar, 
    getAllBookings, 
    getAllCars, 
    getDashboardStats, 
    getAllUsers,
    // Coupon management
    createCoupon,
    getAllCoupons,
    getActiveCoupons,
    updateCoupon,
    deleteCoupon,
    toggleCouponStatus,
    // Location management
    createLocation,
    getAllLocations,
    getActiveLocations,
    updateLocation,
    deleteLocation,
    toggleLocationStatus
} from "../controllers/adminController.js";

const adminRouter = express.Router();

// Middleware to check if user is admin
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.json({ success: false, message: "Not authorized as admin" });
    }
};

// Dashboard & General
adminRouter.get('/stats', getDashboardStats);
adminRouter.get('/bookings', getAllBookings);
adminRouter.get('/cars', getAllCars);
adminRouter.get('/users', getAllUsers);
adminRouter.post('/approve-car', approveCar);

// Coupon Management
adminRouter.post('/coupon/create', createCoupon);
adminRouter.get('/coupons', getAllCoupons);
adminRouter.get('/coupons/active', getActiveCoupons);
adminRouter.post('/coupon/update', updateCoupon);
adminRouter.post('/coupon/delete', deleteCoupon);
adminRouter.post('/coupon/toggle', toggleCouponStatus);

// Location Management
adminRouter.post('/location/create', createLocation);
adminRouter.get('/locations', getAllLocations);
adminRouter.get('/locations/active', getActiveLocations);
adminRouter.post('/location/update', updateLocation);
adminRouter.post('/location/delete', deleteLocation);
adminRouter.post('/location/toggle', toggleLocationStatus);

export default adminRouter;
