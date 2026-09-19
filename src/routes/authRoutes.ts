const router = require("express").Router();
const c = require("../controllers/authController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

router.post("/sign-up", authLimiter, asyncHandler(c.signUp));
router.post("/hospital/sign-up", authLimiter, asyncHandler(c.hospitalSignUp));
router.post("/sign-in", authLimiter, asyncHandler(c.signIn));
router.get("/sign-out", requireAuth, asyncHandler(c.signOut));
router.post("/forgot-password", resetLimiter, asyncHandler(c.forgotPassword));
router.post("/verify-otp", resetLimiter, asyncHandler(c.verifyOtp));
router.post("/reset-password", resetLimiter, asyncHandler(c.resetPassword));
router.post("/change-password", requireAuth, resetLimiter, asyncHandler(c.changePassword));

module.exports = router;

