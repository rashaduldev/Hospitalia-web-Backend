const router = require("express").Router();
const controller = require("../controllers/tenantBillingController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");

router.get("/billing/summary", requireAuth, requireRole("SUPER_ADMIN", "ADMIN"), asyncHandler(controller.summary));

module.exports = router;
