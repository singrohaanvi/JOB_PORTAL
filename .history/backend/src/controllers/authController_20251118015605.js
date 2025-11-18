import jwt from "jsonwebtoken";
import User from "../models/User.js";

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

    // Create user (no OTP, verified immediately)
    const user = await User.create({
      name,
      email,
      password,
      role,
      avatar,
      verified: true, // automatically verified
    });

    res.status(201).json({
      status: "SUCCESS",
      message: "Registration successful.",
      data: {
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
      },
    });
  } catch (err) {
    console.error("Register error:", err.message);
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
