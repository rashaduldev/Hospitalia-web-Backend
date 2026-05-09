const ChatThread = require("../models/ChatThread");
const { success, error, paginated } = require("../utils/apiResponse");
const { pagination } = require("../utils/query");
const { nextId } = require("../utils/ids");

async function createThread(req, res) {
  const thread = await ChatThread.create({ ...req.body, id: await nextId("chatThreads"), messages: [] });
  return success(res, thread, "Chat thread created", 201);
}

async function getThread(req, res) {
  const thread = await ChatThread.findOne({ id: Number(req.params.threadId) }).lean();
  if (!thread) return error(res, "Chat thread not found", 404);
  return success(res, thread, "Chat thread fetched");
}

async function threadsByDoctor(req, res) {
  const { page, limit, skip } = pagination(req);
  const filter = { doctorUserId: Number(req.params.doctorUserId) };
  const [items, total] = await Promise.all([
    ChatThread.find(filter).skip(skip).limit(limit).lean(),
    ChatThread.countDocuments(filter),
  ]);
  return success(res, paginated(items, page, limit, total), "Doctor chat threads fetched");
}

async function threadsByPatient(req, res) {
  const { page, limit, skip } = pagination(req);
  const filter = { patientUserId: Number(req.params.patientUserId) };
  const [items, total] = await Promise.all([
    ChatThread.find(filter).skip(skip).limit(limit).lean(),
    ChatThread.countDocuments(filter),
  ]);
  return success(res, paginated(items, page, limit, total), "Patient chat threads fetched");
}

async function addMessage(req, res) {
  const thread = await ChatThread.findOne({ id: Number(req.params.threadId) });
  if (!thread) return error(res, "Chat thread not found", 404);
  const message = {
    id: await nextId("chatMessages"),
    senderUserId: req.body.senderUserId || req.user?.id,
    body: req.body.body || req.body.message || "",
    attachmentUrl: req.file ? `/uploads/${req.file.filename}` : req.body.attachmentUrl,
    createdAt: new Date(),
  };
  thread.messages.push(message);
  await thread.save();
  return success(res, message, "Message sent", 201);
}

async function messages(req, res) {
  const thread = await ChatThread.findOne({ id: Number(req.params.threadId) }).lean();
  if (!thread) return error(res, "Chat thread not found", 404);
  const { page, limit } = pagination(req);
  const total = thread.messages.length;
  const content = thread.messages.slice(page * limit, page * limit + limit);
  return success(res, paginated(content, page, limit, total), "Messages fetched");
}

module.exports = { createThread, getThread, threadsByDoctor, threadsByPatient, addMessage, messages };

