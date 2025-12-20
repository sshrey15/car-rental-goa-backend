import User from "../models/User.js"
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import Car from "../models/Car.js";
import axios from 'axios';



const generateToken = (userId)=>{
    const payload = { id: userId };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })
}


export const registerUser = async (req, res)=>{
    try {
        const {name, email, password, phone} = req.body
        console.log("DTAA", name, email, password, phone);
        if(!name || !email || !password || !phone || password.length < 8){
            return res.json({success: false, message: 'Fill all the fields'})
        }

        const userExists = await User.findOne({email})
        if(userExists){
            return res.json({success: false, message: 'User already exists'})
        }

        const phoneExists = await User.findOne({phone})
        if(phoneExists){
             if (phoneExists.password) {
                 return res.json({success: false, message: 'User already exists with this phone number'})
             } else {
                 // Update existing OTP user
                 const hashedPassword = await bcrypt.hash(password, 10)
                 phoneExists.name = name;
                 phoneExists.email = email;
                 phoneExists.password = hashedPassword;
                 await phoneExists.save();
                 
                 const token = generateToken(phoneExists._id.toString())
                 return res.json({success: true, token})
             }
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
        const {email,phone, password} = req.body
    
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


export const sendOtp = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.json({ success: false, message: "Phone number is required" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        let user = await User.findOne({ phone });
        
        if (!user) {
            return res.json({ success: false, message: "User not found. Please register first." });
        }

        user.otp = otp;
        user.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
        await user.save();

        let formattedPhone = phone.replace(/\D/g, ''); // Remove non-digits
        if (formattedPhone.length === 10) {
            formattedPhone = '91' + formattedPhone;
        }

        const whatsappUrl = `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
        
        try {
            const response = await axios.post(whatsappUrl, {
                messaging_product: "whatsapp",
                to: formattedPhone,
                type: "text",
                text: {
                    body: `Your OTP for Car Rental Login is: ${otp}`
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log("WhatsApp API Response:", response.data);
            console.log(`OTP for ${phone} sent via WhatsApp: ${otp}`);
            res.json({ success: true, message: "OTP sent successfully to your WhatsApp" });

        } catch (whatsappError) {
            console.error("WhatsApp API Error:", whatsappError.response ? whatsappError.response.data : whatsappError.message);
            return res.json({ success: false, message: "Failed to send OTP via WhatsApp. Please try again." });
        }

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};


export const loginWithOtp = async (req, res) => {
    try {
        const { phone, otp } = req.body;
        
        if (!phone || !otp) {
            return res.json({ success: false, message: "Phone and OTP are required" });
        }

        const user = await User.findOne({ phone });
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        if (!user.otp || user.otp !== otp) {
            return res.json({ success: false, message: "Invalid OTP" });
        }

        if (user.otpExpiry < Date.now()) {
            return res.json({ success: false, message: "OTP has expired" });
        }

       
        user.otp = null;
        user.otpExpiry = null;
        await user.save();

        const token = generateToken(user._id.toString());
        res.json({ success: true, token });

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};



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