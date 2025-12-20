import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {type: String, default: "New User"},
    email: {type: String, unique: true, sparse: true },
    phone: {type: String, required: true, unique: true},
    password: {type: String },
    role: {type: String, enum: ["owner", "user"], default: 'user' },
    image: {type: String, default: ''},
    otp: {type: String},
    otpExpiry: {type: Date},
},{timestamps: true})

const User = mongoose.model('User', userSchema)

export default User