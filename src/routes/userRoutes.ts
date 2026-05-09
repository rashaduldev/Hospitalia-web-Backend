const router = require("express").Router();
const c = require("../controllers/userController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

router.get("/me", requireAuth, asyncHandler(c.me));

module.exports = router;

