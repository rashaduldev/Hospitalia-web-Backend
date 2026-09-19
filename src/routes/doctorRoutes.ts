const router = require("express").Router();
const multer = require("multer");
const c = require("../controllers/doctorController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

router.get("/paginated", asyncHandler(c.listDoctors));
router.get("/id/:userId", requireAuth, requireRole("DOCTOR", "SECRETARY", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.getDoctorByUserId));
router.get("/:doctorId", asyncHandler(c.getDoctorById));
router.put("/update", requireAuth, requireRole("DOCTOR", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.updateDoctor));
router.patch("/update", requireAuth, requireRole("DOCTOR", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.updateDoctor));
router.get("/imported-by/:userId", requireAuth, requireRole("HOSPITAL", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.importedBy));
router.get("/import/sample", requireAuth, requireRole("HOSPITAL", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.downloadImportSample));
router.post("/import/xlsx", requireAuth, requireRole("HOSPITAL", "ADMIN", "SUPER_ADMIN"), upload.single("file"), asyncHandler(c.importDoctors));
router.get("/invitation/info", asyncHandler(c.invitationInfo));
router.post("/onboard", asyncHandler(c.onboard));
router.post("/invite/:doctorId", requireAuth, requireRole("HOSPITAL", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.invite));

router.get("/location/all/:doctorId", asyncHandler(c.locationsByDoctor));
router.get("/location/:locationId", asyncHandler(c.getLocation));
router.post("/location/create", requireAuth, requireRole("DOCTOR", "SECRETARY", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.createLocation));
router.put("/location/update", requireAuth, requireRole("DOCTOR", "SECRETARY", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.updateLocation));
router.delete("/location/delete/locationId/:locationId/doctorId/:doctorId", requireAuth, requireRole("DOCTOR", "SECRETARY", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.deleteLocation));

router.get("/availability/all/doctorId/:doctorId/status", asyncHandler(c.availabilityByDoctor));
router.get("/availability/all/doctorId/:doctorId/location/:doctorLocationId", asyncHandler(c.availabilityByDoctor));
router.post("/availability/create", requireAuth, requireRole("DOCTOR", "SECRETARY", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.createAvailability));
router.put("/availability/update", requireAuth, requireRole("DOCTOR", "SECRETARY", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.updateAvailability));
router.delete("/availability/:id", requireAuth, requireRole("DOCTOR", "SECRETARY", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.deleteAvailability));
router.get("/availability/time-slots/default", asyncHandler(c.defaultTimeSlots));

router.get("/unavailability/all/doctorId/:doctorId", asyncHandler(c.unavailabilityByDoctor));
router.post("/unavailability/set", requireAuth, requireRole("DOCTOR", "SECRETARY", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.createUnavailability));
router.put("/unavailability/update", requireAuth, requireRole("DOCTOR", "SECRETARY", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.updateUnavailability));
router.delete("/unavailability/:id", requireAuth, requireRole("DOCTOR", "SECRETARY", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.deleteUnavailability));

module.exports = router;

