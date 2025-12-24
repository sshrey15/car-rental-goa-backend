import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next)=>{
    try {
        // Check for token in Authorization header or query parameter
        const authHeader = req.headers.authorization;
        const queryToken = req.query.token;
        
        let token;
        
        if(authHeader){
            // Allow both 'Bearer <token>' and raw token in Authorization header
            token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
        } else if(queryToken){
            // Fallback to query parameter (useful for PDF downloads)
            token = queryToken;
        }
        
        if(!token){
            return res.json({success: false, message: "not authorized"})
        }

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