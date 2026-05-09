const router = require("express").Router();
const c = require("../controllers/appointmentController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

router.get("/available-slots/doctor/:doctorId/doctor-location/:doctorLocationId", asyncHandler(c.availableSlots));
router.get("/type/all", asyncHandler(require("../controllers/doctorController").appointmentTypes));
router.post("/book-appointment", requireAuth, asyncHandler(c.book));
router.post("/staff/book-appointment", requireAuth, asyncHandler(c.book));
router.get("/all/upcoming/doctorId/:doctorId", requireAuth, asyncHandler(c.upcomingByDoctor));
router.get("/all/today/doctorId/:doctorId", requireAuth, asyncHandler(c.todayByDoctor));
router.get("/all/past/doctorId/:doctorId", requireAuth, asyncHandler(c.pastByDoctor));
router.get("/all/upcoming/patientUserId/:patientUserId", requireAuth, asyncHandler(c.upcomingByPatient));
router.get("/all/past/patientUserId/:patientUserId", requireAuth, asyncHandler(c.pastByPatient));
router.get("/all/doctorId/:doctorId/doctorLocationId/:locationId", requireAuth, asyncHandler(c.byDoctorLocation));
router.get("/all/past/doctorId/:doctorId/doctorLocationId/:locationId", requireAuth, asyncHandler(c.pastByDoctorLocation));
router.get("/all/doctorId/:doctorId/date/doctorLocationId/:locationId", requireAuth, asyncHandler(c.byDoctorDateLocation));
router.patch("/cancel-appointment/:appointmentId", requireAuth, asyncHandler(c.cancel));
router.put("/cancel-appointment/:appointmentId", requireAuth, asyncHandler(c.cancel));

module.exports = router;
