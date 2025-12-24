import mongoose from "mongoose";

const locationSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Location = mongoose.model('Location', locationSchema);

export default Location;
