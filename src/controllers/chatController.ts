const ChatThread = require("../models/ChatThread");
const { success, error, paginated } = require("../utils/apiResponse");
const { pagination } = require("../utils/query");
const { nextId } = require("../utils/ids");

function isAdmin(user) {
  return user?.userType === "ADMIN" || (user?.roles || []).some((role) => role.roleType === "SUPER_ADMIN");
}

function canAccessThread(user, thread) {
  return isAdmin(user) || [thread.doctorUserId, thread.patientUserId].map(Number).includes(Number(user?.id));
}

async function createThread(req, res) {
  if (!isAdmin(req.user) && ![req.body.doctorUserId, req.body.patientUserId].map(Number).includes(Number(req.user.id))) {
    return error(res, "You cannot create a chat for another user", 403);
  }
  const thread = await ChatThread.create({ ...req.body, id: await nextId("chatThreads"), messages: [] });
  return success(res, thread, "Chat thread created", 201);
}

async function getThread(req, res) {
  const thread = await ChatThread.findOne({ id: Number(req.params.threadId) }).lean();
  if (!thread) return error(res, "Chat thread not found", 404);
  if (!canAccessThread(req.user, thread)) return error(res, "You do not have access to this chat", 403);
  return success(res, thread, "Chat thread fetched");
}

async function threadsByDoctor(req, res) {
  if (!isAdmin(req.user) && Number(req.params.doctorUserId) !== Number(req.user.id)) {
    return error(res, "You do not have access to these chats", 403);
  }
  const { page, limit, skip } = pagination(req);
  const filter = { doctorUserId: Number(req.params.doctorUserId) };
  const [items, total] = await Promise.all([
    ChatThread.find(filter).skip(skip).limit(limit).lean(),
    ChatThread.countDocuments(filter),
  ]);
  return success(res, paginated(items, page, limit, total), "Doctor chat threads fetched");
}

async function threadsByPatient(req, res) {
  if (!isAdmin(req.user) && Number(req.params.patientUserId) !== Number(req.user.id)) {
    return error(res, "You do not have access to these chats", 403);
  }
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
  if (!canAccessThread(req.user, thread)) return error(res, "You do not have access to this chat", 403);
  const message = {
    id: await nextId("chatMessages"),
    senderUserId: req.user.id,
    body: req.body.body || req.body.message || "",
    attachmentUrl: req.body.attachmentUrl,
    createdAt: new Date(),
  };
  thread.messages.push(message);
  await thread.save();
  return success(res, message, "Message sent", 201);
}

async function messages(req, res) {
  const thread = await ChatThread.findOne({ id: Number(req.params.threadId) }).lean();
  if (!thread) return error(res, "Chat thread not found", 404);
  if (!canAccessThread(req.user, thread)) return error(res, "You do not have access to this chat", 403);
  const { page, limit } = pagination(req);
  const total = thread.messages.length;
  const content = thread.messages.slice(page * limit, page * limit + limit);
  return success(res, paginated(content, page, limit, total), "Messages fetched");
}

module.exports = { createThread, getThread, threadsByDoctor, threadsByPatient, addMessage, messages };
