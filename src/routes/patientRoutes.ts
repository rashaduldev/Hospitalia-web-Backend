const router = require("express").Router();
const c = require("../controllers/patientController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

router.get("/id/:userId", requireAuth, asyncHandler(c.getByUserId));
router.put("/update", requireAuth, asyncHandler(c.update));
router.patch("/update", requireAuth, asyncHandler(c.update));
router.get("/search", requireAuth, asyncHandler(c.searchPatients));
router.get("/beneficiary/paginated", requireAuth, asyncHandler(c.beneficiaries));
router.post("/beneficiary/add", requireAuth, asyncHandler(c.addBeneficiary));
router.delete("/beneficiary/delete/:id", requireAuth, asyncHandler(c.deleteBeneficiary));

module.exports = router;

