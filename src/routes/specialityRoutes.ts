const router = require("express").Router();
const c = require("../controllers/doctorController");
const asyncHandler = require("../utils/asyncHandler");

router.get("/all", asyncHandler(c.specialities));

module.exports = router;

