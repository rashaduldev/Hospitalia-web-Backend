const router = require("express").Router();
const c = require("../controllers/hospitalController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

router.get("/hospital/:hospitalId", requireAuth, asyncHandler(c.hospitalDoctors));
router.post("/assign", requireAuth, asyncHandler(c.assignDoctor));
router.delete("/unassign/:id", requireAuth, asyncHandler(c.unassignDoctor));

module.exports = router;

