import jwt from "jsonwebtoken";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { sendOTPVerification } from "./otpController.js";
import UserOTPVerification from "../models/UserOTPVerification.js";

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });

export const register = async (req, res) => {
  try {
    const { name, email, password, role, avatar } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: "User already exists" });

    const user = await User.create({
      name, email, password, role, avatar, verified: false
    });

    await sendOTPVerification(user);

    res.status(201).json({
      status: "PENDING",
      message: "Registration successful. Check your email for OTP.",
      data: { userId: user._id, email: user.email }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { userId, otp } = req.body;
    if (!userId || !otp) return res.status(400).json({ message: "OTP required" });

    const record = await UserOTPVerification.findOne({ userId });
    if (!record) return res.status(400).json({ message: "No OTP found" });

    if (record.expiresAt < Date.now()) {
      await UserOTPVerification.deleteMany({ userId });
      return res.status(400).json({ message: "OTP expired. Request new one." });
    }

    const isValid = await bcrypt.compare(otp, record.otp);
    if (!isValid) return res.status(400).json({ message: "Invalid OTP" });

    await User.updateOne({ _id: userId }, { verified: true });
    await UserOTPVerification.deleteMany({ userId });

    const user = await User.findById(userId);
    res.json({
      status: "VERIFIED",
      message: "Email verified successfully.",
      data: { token: generateToken(user._id), user }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
