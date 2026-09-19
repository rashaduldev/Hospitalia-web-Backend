const router = require("express").Router();
const c = require("../controllers/hospitalController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");

router.get("/hospital/:hospitalId", asyncHandler(c.hospitalDoctors));
router.post("/assign", requireAuth, requireRole("HOSPITAL", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.assignDoctor));
router.delete("/unassign/:id", requireAuth, requireRole("HOSPITAL", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.unassignDoctor));

module.exports = router;

