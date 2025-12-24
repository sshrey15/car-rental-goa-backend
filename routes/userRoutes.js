import express from "express";
import { 
    getCars, 
    getLocations, 
    getUserData, 
    loginUser, 
    registerUser,
    sendOTPController,
    verifyOTPAndRegister,
    verifyOTPAndLogin,
    checkPhoneExists
} from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";

const userRouter = express.Router();

// Traditional auth routes
userRouter.post('/register', registerUser)
userRouter.post('/login', loginUser)
userRouter.get('/data', protect, getUserData)

// OTP auth routes
userRouter.post('/send-otp', sendOTPController)
userRouter.post('/verify-otp-register', verifyOTPAndRegister)
userRouter.post('/verify-otp-login', verifyOTPAndLogin)
userRouter.post('/check-phone', checkPhoneExists)

// Public routes
userRouter.get('/cars', getCars)
userRouter.get('/locations', getLocations)

export default userRouter;