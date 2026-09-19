const router = require("express").Router();
const c = require("../controllers/secretaryController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");

router.post("/assign", requireAuth, requireRole("DOCTOR", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.assignLocation));
router.post("/remove", requireAuth, requireRole("DOCTOR", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.removeLocation));
router.get("/secretary/userId/:userId", requireAuth, requireRole("SECRETARY", "DOCTOR", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.locationsBySecretary));
router.put("/update", requireAuth, requireRole("DOCTOR", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.updateLocation));

module.exports = router;

