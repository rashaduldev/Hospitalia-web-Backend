const router = require("express").Router();
const c = require("../controllers/secretaryController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

router.post("/assign", requireAuth, asyncHandler(c.assignLocation));
router.post("/remove", requireAuth, asyncHandler(c.removeLocation));
router.get("/secretary/userId/:userId", requireAuth, asyncHandler(c.locationsBySecretary));
router.put("/update", requireAuth, asyncHandler(c.updateLocation));

module.exports = router;

