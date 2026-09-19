const router = require("express").Router();
const c = require("../controllers/patientController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");

router.get("/id/:userId", requireAuth, requireRole("PATIENT", "DOCTOR", "SECRETARY", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.getByUserId));
router.put("/update", requireAuth, requireRole("PATIENT", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.update));
router.patch("/update", requireAuth, requireRole("PATIENT", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.update));
router.get("/search", requireAuth, requireRole("DOCTOR", "SECRETARY", "ADMIN", "SUPER_ADMIN"), asyncHandler(c.searchPatients));
router.get("/beneficiary/paginated", requireAuth, requireRole("PATIENT"), asyncHandler(c.beneficiaries));
router.post("/beneficiary/add", requireAuth, requireRole("PATIENT"), asyncHandler(c.addBeneficiary));
router.delete("/beneficiary/delete/:id", requireAuth, requireRole("PATIENT"), asyncHandler(c.deleteBeneficiary));

module.exports = router;

