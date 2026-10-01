const router = require("express").Router();
const controller = require("../controllers/tenantWebsiteController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");

router.get("/website/public", asyncHandler(controller.getPublicWebsite));
router.get("/website", requireAuth, requireRole("SUPER_ADMIN", "ADMIN"), asyncHandler(controller.getWebsiteEditor));
router.put("/website", requireAuth, requireRole("SUPER_ADMIN", "ADMIN"), asyncHandler(controller.saveDraft));
router.post("/website/publish", requireAuth, requireRole("SUPER_ADMIN", "ADMIN"), asyncHandler(controller.publishWebsite));

module.exports = router;
