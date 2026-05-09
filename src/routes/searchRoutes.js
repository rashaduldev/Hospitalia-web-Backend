const router = require("express").Router();
const c = require("../controllers/searchController");
const asyncHandler = require("../utils/asyncHandler");

router.get("/search", asyncHandler(c.globalSearch));
router.post("/search", asyncHandler(c.globalSearch));
router.get("/cities/doctors", asyncHandler(c.doctorCities));
router.get("/cities/hospitals", asyncHandler(c.hospitalCities));

module.exports = router;
