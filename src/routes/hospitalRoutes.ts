const router = require("express").Router();
const c = require("../controllers/hospitalController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");

router.get("/locations/hospital/:hospitalId", requireAuth, requireRole("HOSPITAL", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.locations));
router.post("/locations/create", requireAuth, requireRole("HOSPITAL", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.createLocation));
router.put("/locations/update", requireAuth, requireRole("HOSPITAL", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.updateLocation));
router.delete("/locations/delete/:locationId", requireAuth, requireRole("HOSPITAL", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.deleteLocation));
router.get("/public/:id", asyncHandler(c.getById));
router.get("/id/:hospitalUserId", requireAuth, requireRole("HOSPITAL", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.getByUserId));
router.get("/paginated/user/:userId", requireAuth, requireRole("HOSPITAL", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.paginatedByUser));
router.post("/create", requireAuth, requireRole("HOSPITAL", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.create));
router.put("/update/:id", requireAuth, requireRole("HOSPITAL", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.update));
router.delete("/delete/id/:id", requireAuth, requireRole("HOSPITAL", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.remove));
router.get("/:id", requireAuth, requireRole("HOSPITAL", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.getById));

module.exports = router;

