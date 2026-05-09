const router = require("express").Router();
const c = require("../controllers/doctorController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

router.get("/paginated", asyncHandler(c.listDoctors));
router.get("/id/:userId", asyncHandler(c.getDoctorByUserId));
router.get("/:doctorId", asyncHandler(c.getDoctorById));
router.put("/update", requireAuth, asyncHandler(c.updateDoctor));
router.patch("/update", requireAuth, asyncHandler(c.updateDoctor));
router.get("/imported-by/:userId", requireAuth, asyncHandler(c.importedBy));
router.get("/invitation/info", asyncHandler(c.invitationInfo));
router.post("/onboard", asyncHandler(c.onboard));
router.post("/invite/:doctorId", requireAuth, asyncHandler(c.invite));

router.get("/location/all/:doctorId", asyncHandler(c.locationsByDoctor));
router.get("/location/:locationId", asyncHandler(c.getLocation));
router.post("/location/create", requireAuth, asyncHandler(c.createLocation));
router.put("/location/update", requireAuth, asyncHandler(c.updateLocation));
router.delete("/location/delete/locationId/:locationId/doctorId/:doctorId", requireAuth, asyncHandler(c.deleteLocation));

router.get("/availability/all/doctorId/:doctorId/status", asyncHandler(c.availabilityByDoctor));
router.get("/availability/all/doctorId/:doctorId/location/:doctorLocationId", asyncHandler(c.availabilityByDoctor));
router.post("/availability/create", requireAuth, asyncHandler(c.createAvailability));
router.put("/availability/update", requireAuth, asyncHandler(c.updateAvailability));
router.delete("/availability/:id", requireAuth, asyncHandler(c.deleteAvailability));
router.get("/availability/time-slots/default", asyncHandler(c.defaultTimeSlots));

router.get("/unavailability/all/doctorId/:doctorId", asyncHandler(c.unavailabilityByDoctor));
router.post("/unavailability/set", requireAuth, asyncHandler(c.createUnavailability));
router.put("/unavailability/update", requireAuth, asyncHandler(c.updateUnavailability));
router.delete("/unavailability/:id", requireAuth, asyncHandler(c.deleteUnavailability));

module.exports = router;

