const router = require("express").Router();
const multer = require("multer");
const c = require("../controllers/chatController");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

const upload = multer({ dest: "uploads/" });

router.post("/threads", requireAuth, asyncHandler(c.createThread));
router.get("/threads/id/:threadId", requireAuth, asyncHandler(c.getThread));
router.get("/threads/doctor/:doctorUserId", requireAuth, asyncHandler(c.threadsByDoctor));
router.get("/threads/patient/:patientUserId", requireAuth, asyncHandler(c.threadsByPatient));
router.post("/threads/:threadId/messages", requireAuth, upload.single("file"), asyncHandler(c.addMessage));
router.get("/threads/:threadId/messages", requireAuth, asyncHandler(c.messages));

module.exports = router;
