const router = require("express").Router();
const { resolveTenant } = require("../middleware/tenantContext");

router.use("/platform", require("./platformRoutes"));
router.use(resolveTenant);
router.use("/tenant", require("./tenantWebsiteRoutes"));
router.use("/tenant", require("./tenantBillingRoutes"));
router.use("/auth", require("./authRoutes"));
router.use("/admin", require("./adminRoutes"));
router.use("/users", require("./userRoutes"));
router.use("/doctors", require("./doctorRoutes"));
router.use("/appointments", require("./appointmentRoutes"));
router.use("/hospitals", require("./hospitalRoutes"));
router.use("/hospital-doctors", require("./hospitalDoctorRoutes"));
router.use("/patients", require("./patientRoutes"));
router.use("/secretaries", require("./secretaryRoutes"));
router.use("/secretary-locations", require("./secretaryLocationRoutes"));
router.use("/global-search", require("./searchRoutes"));
router.use("/speciality", require("./specialityRoutes"));
router.use("/chat", require("./chatRoutes"));

module.exports = router;

