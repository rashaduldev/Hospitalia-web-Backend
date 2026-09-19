const User = require("../models/User");
const { success, error, paginated } = require("../utils/apiResponse");
const { pagination, textSearch } = require("../utils/query");
const { nextId } = require("../utils/ids");
const bcrypt = require("bcryptjs");

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    gender: user.gender,
    email: user.email,
    countryCode: user.countryCode,
    mobileNumber: user.mobileNumber,
    userType: user.userType,
    status: user.status,
    roles: user.roles,
    userDetails: { id: user.id, firstName: user.firstName, lastName: user.lastName },
  };
}

async function me(req, res) {
  const user = await User.findOne({ id: req.user.id }).lean();
  return success(res, publicUser(user), "Current user fetched");
}

async function listUsers(req, res) {
  const { page, limit, skip } = pagination(req);
  const filter = {
    ...textSearch(req.query.search, ["firstName", "lastName", "email", "mobileNumber"]),
    ...(req.query.userType ? { userType: req.query.userType } : {}),
    ...(req.query.status ? { status: req.query.status } : {}),
  };
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  return success(res, paginated(items.map(publicUser), page, limit, total), "Users fetched");
}

async function getUser(req, res) {
  const user = await User.findOne({ id: Number(req.params.id) }).lean();
  if (!user) return error(res, "User not found", 404);
  return success(res, publicUser(user), "User fetched");
}

async function createUser(req, res) {
  if (!req.body.password || String(req.body.password).length < 8) {
    return error(res, "Password must be at least 8 characters", 422);
  }
  const id = await nextId("users");
  const passwordHash = await bcrypt.hash(String(req.body.password), 12);
  const { password: _password, passwordHash: _passwordHash, id: _id, ...safeBody } = req.body;
  const user = await User.create({
    ...safeBody,
    id,
    passwordHash,
    userType: req.body.userType || "PATIENT",
    roles: req.body.roles || [{ roleName: req.body.userType || "PATIENT", roleType: req.body.userType || "PATIENT" }],
  });
  return success(res, publicUser(user), "User created", 201);
}

async function updateUser(req, res) {
  const id = Number(req.body.id || req.body.userId);
  const { id: _id, userId: _userId, passwordHash: _passwordHash, password, ...safeBody } = req.body;
  if (password && String(password).length < 8) return error(res, "Password must be at least 8 characters", 422);
  const update = {
    ...safeBody,
    ...(password ? { passwordHash: await bcrypt.hash(String(password), 12) } : {}),
  };
  const user = await User.findOneAndUpdate({ id }, update, { new: true });
  if (!user) return error(res, "User not found", 404);
  return success(res, publicUser(user), "User updated");
}

async function updateStatus(req, res) {
  const user = await User.findOneAndUpdate({ id: Number(req.body.id || req.body.userId) }, { status: req.body.status }, { new: true });
  if (!user) return error(res, "User not found", 404);
  return success(res, publicUser(user), "User status updated");
}

async function deleteUser(req, res) {
  const id = Number(req.body.id || req.query.id);
  await User.deleteOne({ id });
  return success(res, null, "User deleted");
}

module.exports = { me, listUsers, getUser, createUser, updateUser, updateStatus, deleteUser, publicUser };

