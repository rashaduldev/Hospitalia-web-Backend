const router = require("express").Router();
const c = require("../controllers/authController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

router.post("/sign-up", asyncHandler(c.signUp));
router.post("/hospital/sign-up", asyncHandler(c.hospitalSignUp));
router.post("/sign-in", asyncHandler(c.signIn));
router.get("/sign-out", requireAuth, asyncHandler(c.signOut));
router.post("/forgot-password", asyncHandler(c.forgotPassword));
router.post("/verify-otp", asyncHandler(c.verifyOtp));
router.post("/reset-password", asyncHandler(c.resetPassword));

module.exports = router;
