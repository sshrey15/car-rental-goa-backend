import User from "../models/User.js"
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import Car from "../models/Car.js";
import Location from "../models/Location.js";
import { sendOTP as twilioSendOTP, verifyOTP as twilioVerifyOTP } from "../configs/twilio.js";



const generateToken = (userId)=>{
    const payload = { id: userId };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })
}


export const registerUser = async (req, res)=>{
    try {
        const {name, email, password, phone} = req.body
        
        if(!name || !email || !password || !phone){
            return res.json({success: false, message: 'Please fill all the fields'})
        }
        
        if(password.length < 8){
            return res.json({success: false, message: 'Password must be at least 8 characters'})
        }

        const userExists = await User.findOne({email})
        if(userExists){
            return res.json({success: false, message: 'User already exists with this email'})
        }

        const phoneExists = await User.findOne({phone})
        if(phoneExists){
            return res.json({success: false, message: 'User already exists with this phone number'})
        }

        const hashedPassword = await bcrypt.hash(password, 10)
        const user = await User.create({name, email, password: hashedPassword, phone})
        const token = generateToken(user._id.toString())
        res.json({success: true, token})

    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}


export const loginUser = async (req, res)=>{
    try {
        const {email, password} = req.body
    
        if(!email || !password){
            return res.json({success: false, message: "Please fill all the fields" })
        }

        const user = await User.findOne({email})
        if(!user){
            return res.json({success: false, message: "User not found" })
        }
        
        const isMatch = await bcrypt.compare(password, user.password)
        if(!isMatch){
            return res.json({success: false, message: "Invalid Credentials" })
        }
        
        const token = generateToken(user._id.toString())
        res.json({success: true, token})
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}


export const getUserData = async (req, res) =>{
    try {
        const {user} = req;
        res.json({success: true, user})
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

// Get All Cars for the Frontend
export const getCars = async (req, res) =>{
    try {
        const cars = await Car.find({ isApproved: true })
        res.json({success: true, cars})
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

// Get All Active Locations for the Frontend
export const getLocations = async (req, res) =>{
    try {
        const locations = await Location.find({ isActive: true }).sort({ name: 1 })
        res.json({success: true, locations})
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

// ========== OTP AUTHENTICATION ==========

// Send OTP to phone number
export const sendOTPController = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.json({ success: false, message: 'Phone number is required' });
        }

        // Validate phone number (10 digits for India)
        const phoneRegex = /^[6-9]\d{9}$/;
        if (!phoneRegex.test(phone)) {
            return res.json({ success: false, message: 'Please enter a valid 10-digit phone number' });
        }

        const result = await twilioSendOTP(phone);
        
        if (result.success) {
            res.json({ success: true, message: 'OTP sent successfully' });
        } else {
            res.json({ success: false, message: result.message || 'Failed to send OTP' });
        }
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// Verify OTP and Register new user
export const verifyOTPAndRegister = async (req, res) => {
    try {
        const { name, email, phone, password, otp } = req.body;

        if (!name || !email || !phone || !password || !otp) {
            return res.json({ success: false, message: 'All fields are required' });
        }

        if (password.length < 8) {
            return res.json({ success: false, message: 'Password must be at least 8 characters' });
        }

        // Verify OTP first
        const otpResult = await twilioVerifyOTP(phone, otp);
        
        if (!otpResult.success) {
            return res.json({ success: false, message: 'Invalid or expired OTP' });
        }

        // Check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.json({ success: false, message: 'User already exists with this email' });
        }

        const phoneExists = await User.findOne({ phone });
        if (phoneExists) {
            return res.json({ success: false, message: 'User already exists with this phone number' });
        }

        // Create user with verified phone
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            phone,
            isPhoneVerified: true
        });

        const token = generateToken(user._id.toString());
        res.json({ success: true, token, message: 'Registration successful' });

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// Verify OTP and Login user (for phone-based login)
export const verifyOTPAndLogin = async (req, res) => {
    try {
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return res.json({ success: false, message: 'Phone and OTP are required' });
        }

        // Verify OTP
        const otpResult = await twilioVerifyOTP(phone, otp);
        
        if (!otpResult.success) {
            return res.json({ success: false, message: 'Invalid or expired OTP' });
        }

        // Find user by phone
        const user = await User.findOne({ phone });
        
        if (!user) {
            return res.json({ success: false, message: 'User not found. Please register first.', notRegistered: true });
        }

        // Update phone verified status
        if (!user.isPhoneVerified) {
            user.isPhoneVerified = true;
            await user.save();
        }

        const token = generateToken(user._id.toString());
        res.json({ success: true, token, message: 'Login successful' });

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// Check if phone number is registered
export const checkPhoneExists = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.json({ success: false, message: 'Phone number is required' });
        }

        const user = await User.findOne({ phone });
        res.json({ success: true, exists: !!user });

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};