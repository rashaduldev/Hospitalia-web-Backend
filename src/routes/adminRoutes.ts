const router = require("express").Router();
const auth = require("../controllers/authController");
const admin = require("../controllers/adminController");
const users = require("../controllers/userController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

router.post("/auth/sign-in", asyncHandler(auth.adminSignIn));
router.get("/stats/dashboard", requireAuth, asyncHandler(admin.dashboard));

router.get("/speciality/all", asyncHandler(admin.allSpecialities));
router.post("/speciality/create", requireAuth, asyncHandler(admin.createSpeciality));
router.put("/speciality/update/id:id", requireAuth, asyncHandler(admin.updateSpeciality));
router.put("/speciality/update/id/:id", requireAuth, asyncHandler(admin.updateSpeciality));
router.delete("/speciality/delete/id/:id", requireAuth, asyncHandler(admin.deleteSpeciality));
router.get("/speciality/id/:id", asyncHandler(admin.getSpeciality));

router.get("/users/paginated", requireAuth, asyncHandler(users.listUsers));
router.get("/users/id/:id", requireAuth, asyncHandler(users.getUser));
router.post("/users/create", requireAuth, asyncHandler(users.createUser));
router.put("/users/update", requireAuth, asyncHandler(users.updateUser));
router.patch("/users/status/update", requireAuth, asyncHandler(users.updateStatus));
router.delete("/users/delete", requireAuth, asyncHandler(users.deleteUser));

router.get("/roles/paginated", requireAuth, asyncHandler(admin.listRoles));
router.get("/roles/id/:id", requireAuth, asyncHandler(admin.getRole));
router.get("/roles/role-type/all", requireAuth, asyncHandler(admin.roleTypes));
router.get("/privileges", requireAuth, asyncHandler(admin.listPrivileges));
router.post("/roles/create", requireAuth, asyncHandler(admin.createRole));
router.put("/roles/update", requireAuth, asyncHandler(admin.updateRole));
router.delete("/roles/id/:id/delete", requireAuth, asyncHandler(admin.deleteRole));

module.exports = router;

