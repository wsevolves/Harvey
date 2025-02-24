const express = require("express");
const bcrypt = require("bcryptjs");
const UsersCollection = require("../models/UsersCollection"); // Import model
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const router = express.Router();


const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, // Example: mail.yourdomain.com
    port: process.env.SMTP_PORT, // Typically 465 (SSL) or 587 (TLS)
    secure: process.env.SMTP_PORT == 465, // True for 465, false for others
    auth: {
        user: process.env.SMTP_USER, // Your domain email (e.g., support@yourdomain.com)
        pass: process.env.SMTP_PASS, // SMTP password
    },
});
transporter.verify((error, success) => {
    if (error) {
        console.error("❌ SMTP Connection Failed:", error);
    } else {
        console.log("✅ SMTP Server is Ready to Send Emails");
    }
});

// Signup Route

router.post("/signup", async (req, res) => {
    try {
        const { full_name, email, phone, password } = req.body;

        // Find the document that holds all users
        let userCollection = await UsersCollection.findOne();

        if (!userCollection) {
            userCollection = new UsersCollection({ users: [] }); // Create if not exists
        }

        // Check if email or phone already exists in the array
        const existingUser = userCollection.users.find(
            (u) => u.email === email || u.phone === phone
        );
        if (existingUser) return res.status(400).json({ msg: "Email or phone already in use" });

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Add user to the array
        const newUser = {
            unique_id: uuidv4(),
            full_name,
            email,
            phone,
            password_hash: hashedPassword
        };

        userCollection.users.push(newUser);
        await userCollection.save();

        // Store user in session
        req.session.user = {
            id: newUser.unique_id,
            full_name: newUser.full_name,
            email: newUser.email,
            phone: newUser.phone
        };

        res.json({ msg: "Signup successful", user: req.session.user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: "Server Error" });
    }
});

// Login Route
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find the document containing all users
        const userCollection = await UsersCollection.findOne();
        if (!userCollection) return res.status(404).json({ msg: "No users found" });

        // Find the user inside the `users` array
        const user = userCollection.users.find((u) => u.email === email);
        if (!user) return res.status(400).json({ msg: "Invalid Credentials" });

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(400).json({ msg: "Invalid Credentials" });

        // Store user in session
        req.session.user = { 
            id: user.unique_id, 
            full_name: user.full_name, 
            email: user.email, 
            phone: user.phone 
        };

        res.json({ msg: "Login successful", user: req.session.user });
    } catch (error) {
        console.error("❌ Login Error:", error);
        res.status(500).json({ msg: "Server Error" });
    }
});


// Logout Route
router.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ msg: "Logout failed" });
        res.json({ msg: "Logout successful" });
    });
});

//get all User
router.get("/users", async (req, res) => {
    try {
        const userCollection = await UsersCollection.findOne();
        if (!userCollection || userCollection.users.length === 0) {
            return res.status(404).json({ msg: "No users found" });
        }

        res.json({ users: userCollection.users });
    } catch (error) {
        console.error("❌ Error fetching users:", error);
        res.status(500).json({ msg: "Internal Server Error" });
    }
});

router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    // Find the document containing all users
    const userCollection = await UsersCollection.findOne();
    if (!userCollection) return res.status(404).json({ message: "No users found" });

    // Find the user inside the `users` array
    const userIndex = userCollection.users.findIndex((u) => u.email === email);
    if (userIndex === -1) {
        return res.status(404).json({ message: "No account found with this email" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000); // Generate 6-digit OTP
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // OTP expires in 5 minutes

    const mailOptions = {
        from: `"Support" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Password Reset OTP",
        html: `<p>Your OTP for password reset is: <strong>${otp}</strong></p>`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("✅ OTP Sent Successfully:", otp);

        // Store OTP & expiry time in the `users` array
        userCollection.users[userIndex].otp = otp;
        userCollection.users[userIndex].otpExpires = otpExpires;

        await userCollection.save();

        res.json({ message: "OTP sent successfully" });
    } catch (error) {
        console.error("❌ Error sending OTP:", error);
        res.status(500).json({ message: "Error sending OTP", error });
    }
});

// ✅ Verify OTP before resetting password
router.post("/verify-otp", async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required" });

    const userCollection = await UsersCollection.findOne();
    if (!userCollection) return res.status(404).json({ message: "No users found" });

    const user = userCollection.users.find((u) => u.email === email);
    if (!user || user.otp !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.otpExpires < Date.now()) {
        return res.status(400).json({ message: "OTP has expired" });
    }

    res.json({ message: "OTP verified successfully" });
});


// ✅ Reset Password with OTP
router.post("/reset-password", async (req, res) => {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
        return res.status(400).json({ message: "All fields are required" });
    }

    const userCollection = await UsersCollection.findOne();
    if (!userCollection) return res.status(404).json({ message: "No users found" });

    const userIndex = userCollection.users.findIndex((u) => u.email === email);
    if (userIndex === -1) {
        return res.status(400).json({ message: "Invalid OTP" });
    }

    const user = userCollection.users[userIndex];

    if (user.otp !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.otpExpires < Date.now()) {
        return res.status(400).json({ message: "OTP has expired" });
    }

    // ✅ Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // ✅ Update password and clear OTP
    userCollection.users[userIndex].password_hash = hashedPassword;
    userCollection.users[userIndex].otp = null;
    userCollection.users[userIndex].otpExpires = null;

    await userCollection.save();

    // ✅ Send confirmation email
    const confirmationMailOptions = {
        from: `"Support" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Password Reset Successful",
        html: `<p>Your password has been successfully reset.</p>`,
    };

    try {
        await transporter.sendMail(confirmationMailOptions);
        console.log("✅ Password Reset Confirmation Sent");

        res.json({ message: "Password reset successful" });
    } catch (error) {
        console.error("❌ Error sending confirmation email:", error);
        res.status(500).json({ message: "Password reset successful, but failed to send confirmation email" });
    }
});



module.exports = router;
