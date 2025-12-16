import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next)=>{
    try {
        const authHeader = req.headers.authorization;
        if(!authHeader){
            return res.json({success: false, message: "not authorized"})
        }

        // Allow both 'Bearer <token>' and raw token in Authorization header
        const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

        // Verify token signature and extract payload
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        if(!payload || !payload.id){
            return res.json({success: false, message: "not authorized"})
        }

        req.user = await User.findById(payload.id).select("-password")
        if(!req.user){
            return res.json({success: false, message: "not authorized"})
        }

        next();
    } catch (error) {
        console.log('Auth middleware error:', error.message);
        return res.json({success: false, message: "not authorized"})
    }
}