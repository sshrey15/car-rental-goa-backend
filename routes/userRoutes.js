import express from "express";
import { getCars, getUserData, loginUser, registerUser, sendOtp, loginWithOtp } from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";

const userRouter = express.Router();

userRouter.post('/register', registerUser)
userRouter.post('/login', loginUser)
userRouter.post('/send-otp', sendOtp)
userRouter.post('/login-otp', loginWithOtp)
userRouter.get('/data', protect, getUserData)
userRouter.get('/cars', getCars)

export default userRouter;