const router = require("express").Router();
const c = require("../controllers/secretaryController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");

router.post("/create", requireAuth, requireRole("DOCTOR", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.create));
router.post("/invite/:secretaryUserId", requireAuth, requireRole("DOCTOR", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.invite));
router.post("/resend-invitation/:secretaryUserId", requireAuth, requireRole("DOCTOR", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.invite));
router.get("/invitation/info", asyncHandler(c.invitationInfo));
router.post("/onboard", asyncHandler(c.onboard));
router.get("/userId/:userId", requireAuth, requireRole("SECRETARY", "DOCTOR", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.getByUserId));
router.get("/doctorUserId/:doctorUserId", requireAuth, requireRole("DOCTOR", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.byDoctorUserId));
router.delete("/delete/userId/:userId", requireAuth, requireRole("DOCTOR", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.remove));

module.exports = router;

