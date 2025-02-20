const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const redisClient = require("../config/redis");
const sendOTPEmail = require("../config/email");

const router = express.Router();

// 🔹 User Registration
router.post("/register", async (req, res) => {
  let { name, email, password, profileImage, company, age, dob } = req.body;
  dob = dob ? new Date(dob) : null;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, company, age, dob, profileImage });
    await user.save();
    res.status(201).json({ message: "User Registered Successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error Registering User", error });
  }
});

// 🔹 User Login + OTP Generation
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid Credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid Credentials" });

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    await redisClient.setEx(email, 600, otp.toString()); // OTP expires in 10 minutes

    // Send OTP Email
    await sendOTPEmail(email, otp);

    res.status(200).json({ message: "OTP Sent to Email" });
  } catch (error) {
    res.status(500).json({ message: "Login Failed", error });
  }
});

// 🔹 OTP Verification
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  
  try {
    const storedOTP = await redisClient.get(email);
    console.log(storedOTP, otp);
    
    if (!storedOTP || storedOTP != otp) return res.status(401).json({ message: "Invalid OTP" });

    // Generate JWT Token
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.status(200).json({ message: "OTP Verified", token });
  } catch (error) {
    res.status(500).json({ message: "OTP Verification Failed", error });
  }
});

module.exports = router;
