const router = require("express").Router();
const auth = require("../controllers/authController");
const admin = require("../controllers/adminController");
const users = require("../controllers/userController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const rateLimit = require("express-rate-limit");

const adminAuthLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

router.post("/auth/sign-in", adminAuthLimiter, asyncHandler(auth.adminSignIn));
router.get("/stats/dashboard", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(admin.dashboard));

router.get("/speciality/all", asyncHandler(admin.allSpecialities));
router.post("/speciality/create", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(admin.createSpeciality));
router.put("/speciality/update/id/:id", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(admin.updateSpeciality));
router.delete("/speciality/delete/id/:id", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(admin.deleteSpeciality));
router.get("/speciality/id/:id", asyncHandler(admin.getSpeciality));

router.get("/users/paginated", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(users.listUsers));
router.get("/users/id/:id", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(users.getUser));
router.post("/users/create", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(users.createUser));
router.put("/users/update", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(users.updateUser));
router.patch("/users/status/update", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(users.updateStatus));
router.delete("/users/delete", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(users.deleteUser));

router.get("/roles/paginated", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(admin.listRoles));
router.get("/roles/id/:id", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(admin.getRole));
router.get("/roles/role-type/all", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(admin.roleTypes));
router.get("/privileges", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(admin.listPrivileges));
router.post("/roles/create", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(admin.createRole));
router.put("/roles/update", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(admin.updateRole));
router.delete("/roles/id/:id/delete", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(admin.deleteRole));

module.exports = router;

