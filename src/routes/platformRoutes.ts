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
router.post("/subscriptions/:id/suspend", ...superAdmin, asyncHandler(controller.suspendSubscription));
router.post("/subscriptions/:id/reactivate", ...superAdmin, asyncHandler(controller.reactivateSubscription));
router.post("/subscriptions/:id/cancel", ...superAdmin, asyncHandler(controller.cancelSubscription));
router.get("/invoices", ...superAdmin, asyncHandler(controller.listInvoices));
router.post("/invoices", ...superAdmin, asyncHandler(controller.createInvoice));
router.post("/invoices/:id/issue", ...superAdmin, asyncHandler(controller.issueInvoice));
router.post("/invoices/:id/payments", ...superAdmin, asyncHandler(controller.submitPayment));
router.get("/payments", ...superAdmin, asyncHandler(controller.listPayments));
router.post("/payments/:id/verify", ...superAdmin, asyncHandler(controller.verifyPayment));
router.post("/payments/:id/reject", ...superAdmin, asyncHandler(controller.rejectPayment));

module.exports = router;
