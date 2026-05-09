const router = require("express").Router();
const c = require("../controllers/secretaryController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

router.post("/create", requireAuth, asyncHandler(c.create));
router.post("/invite/:secretaryUserId", requireAuth, asyncHandler(c.invite));
router.post("/resend-invitation/:secretaryUserId", requireAuth, asyncHandler(c.invite));
router.get("/invitation/info", asyncHandler(c.invitationInfo));
router.post("/onboard", asyncHandler(c.onboard));
router.get("/userId/:userId", requireAuth, asyncHandler(c.getByUserId));
router.get("/doctorUserId/:doctorUserId", requireAuth, asyncHandler(c.byDoctorUserId));
router.delete("/delete/userId/:userId", requireAuth, asyncHandler(c.remove));

module.exports = router;

