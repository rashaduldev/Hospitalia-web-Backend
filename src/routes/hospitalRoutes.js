const router = require("express").Router();
const c = require("../controllers/hospitalController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

router.get("/locations/hospital/:hospitalId", requireAuth, asyncHandler(c.locations));
router.post("/locations/create", requireAuth, asyncHandler(c.createLocation));
router.put("/locations/update", requireAuth, asyncHandler(c.updateLocation));
router.delete("/locations/delete/:locationId", requireAuth, asyncHandler(c.deleteLocation));
router.get("/public/:id", asyncHandler(c.getById));
router.get("/id/:hospitalUserId", requireAuth, asyncHandler(c.getByUserId));
router.get("/paginated/user/:userId", requireAuth, asyncHandler(c.paginatedByUser));
router.post("/create", requireAuth, asyncHandler(c.create));
router.put("/update/:id", requireAuth, asyncHandler(c.update));
router.delete("/delete/id/:id", requireAuth, asyncHandler(c.remove));
router.get("/:id", requireAuth, asyncHandler(c.getById));

module.exports = router;
