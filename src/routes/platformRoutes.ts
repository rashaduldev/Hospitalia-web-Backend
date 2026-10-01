const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const controller = require("../controllers/platformController");
const asyncHandler = require("../utils/asyncHandler");
const { requirePlatformAuth, requirePlatformRole } = require("../middleware/platformAuth");

const platformSignInLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const superAdmin = [requirePlatformAuth, requirePlatformRole("PLATFORM_SUPER_ADMIN")];

router.post("/auth/sign-in", platformSignInLimiter, asyncHandler(controller.signIn));
router.get("/me", requirePlatformAuth, asyncHandler(controller.me));
router.get("/tenants", ...superAdmin, asyncHandler(controller.listTenants));
router.post("/tenants", ...superAdmin, asyncHandler(controller.createTenant));
router.get("/tenants/:tenantId", ...superAdmin, asyncHandler(controller.getTenant));
router.get("/plans", ...superAdmin, asyncHandler(controller.listPlans));
router.post("/plans", ...superAdmin, asyncHandler(controller.createPlan));
router.get("/subscriptions", ...superAdmin, asyncHandler(controller.listSubscriptions));
router.post("/subscriptions", ...superAdmin, asyncHandler(controller.createSubscription));

module.exports = router;
