const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const UserSchema = new mongoose.Schema({
    users: [
        {
            unique_id: {
                type: String,
                default: uuidv4,
                unique: true
            },
            full_name: {
                type: String,
                required: true
            },
            email: {
                type: String,
                required: true,
                unique: true
            },
            phone: {
                type: String,
                required: true,
                unique: true
            },
            password_hash: {
                type: String,
                required: true
            },
            role: {
                type: String,
                enum: ["user", "admin"],
                default: "user"
            },
            resetPasswordToken: {
                type: String,
                default: null
            },
            resetPasswordExpires: {
                type: Date,
                default: null
            },
            otp: {  // ✅ Add OTP field
                type: String,
                default: null
            },
            otpExpires: {  // ✅ Expiry time for OTP (5 minutes)
                type: Date,
                default: null
            },
            created_at: {
                type: Date,
                default: Date.now
            },
            updated_at: {
                type: Date,
                default: Date.now
            }
        }
    ]
});

// Ensure there's only one document to store all users
const UsersCollection = mongoose.model("UsersCollection", UserSchema);

module.exports = UsersCollection;
