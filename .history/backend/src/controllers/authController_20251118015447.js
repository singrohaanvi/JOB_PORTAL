import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import UserOTPVerification from "../models/UserOTPVerification.js";
import { sendOTPVerification } from "./otpController.js";

// -----------------------------
// JWT TOKEN GENERATOR
// -----------------------------
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// -----------------------------
// REGISTER NEW USER
// -----------------------------
export const register = async (req, res) => {
  try {
    const { name, email, password, avatar, role } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create user (unverified by default)
    const user = await User.create({
      name,
      email,
      password,
      role,
      avatar,
      verified: false,
    });

    // Send OTP to user email
    await sendOTPVerification(user);

    res.status(201).json({
      status: "PENDING",
      message: "Registration successful. Please verify your email.",
      data: { userId: user._id, email: user.email },
    });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ message: "Server error: " + err.message });
  }
};

// -----------------------------
// VERIFY OTP
// -----------------------------
export const verifyOTP = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ message: "OTP and User ID are required" });
    }

    const record = await UserOTPVerification.findOne({ userId });
    if (!record) return res.status(400).json({ message: "No OTP record found" });

    // Check expiry
    if (record.expiresAt < Date.now()) {
      await UserOTPVerification.deleteMany({ userId });
      return res.status(400).json({ message: "OTP expired. Request a new one." });
    }

    // Validate OTP
    const isValid = await bcrypt.compare(otp, record.otp);
    if (!isValid) return res.status(400).json({ message: "Invalid OTP" });

    // Mark user as verified
    await User.updateOne({ _id: userId }, { verified: true });
    await UserOTPVerification.deleteMany({ userId });

    const user = await User.findById(userId);

    res.status(200).json({
      status: "VERIFIED",
      message: "Email verified successfully.",
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          token: generateToken(user._id),
          companyName: user.companyName || "",
          companyDescription: user.companyDescription || "",
          companyLogo: user.companyLogo || "",
          resume: user.resume || "",
        },
      },
    });
  } catch (err) {
    console.error("Verify OTP error:", err.message);
    res.status(500).json({ message: "Server error: " + err.message });
  }
};

// -----------------------------
// LOGIN
// -----------------------------
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: "Invalid email or password" });

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid email or password" });

    // Check if email verified
    if (!user.verified)
      return res
        .status(401)
        .json({ message: "Email not verified. Please check your inbox." });

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      token: generateToken(user._id),
      companyName: user.companyName || "",
      companyDescription: user.companyDescription || "",
      companyLogo: user.companyLogo || "",
      resume: user.resume || "",
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Server error: " + err.message });
  }
};

// -----------------------------
// GET CURRENT USER
// -----------------------------
export const getMe = async (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (err) {
    console.error("GetMe error:", err.message);
    res.status(500).json({ message: "Server error: " + err.message });
  }
};
