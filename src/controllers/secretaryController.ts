const Secretary = require("../models/Secretary");
const SecretaryLocation = require("../models/SecretaryLocation");
const Location = require("../models/Location");
const Doctor = require("../models/Doctor");
const { success, error, paginated } = require("../utils/apiResponse");
const { pagination } = require("../utils/query");
const { nextId } = require("../utils/ids");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { randomBytes } = require("node:crypto");

function isAdmin(user) {
  return user?.userType === "ADMIN" || (user?.roles || []).some((role) => role.roleType === "SUPER_ADMIN");
}

function canManageDoctor(user, doctorUserId) {
  return isAdmin(user) || (user?.userType === "DOCTOR" && Number(user.id) === Number(doctorUserId));
}

async function create(req, res) {
  if (!canManageDoctor(req.user, req.body.doctorUserId)) return error(res, "You cannot add secretaries for another doctor", 403);
  const userId = Number(req.body.userId) || await nextId("users");
  const item = await Secretary.create({
    ...req.body,
    userId,
    id: await nextId("secretaries"),
    status: req.body.status || "PENDING",
  });
  return success(res, item, "Secretary created", 201);
}

async function invite(req, res) {
  const existing = await Secretary.findOne({ userId: Number(req.params.secretaryUserId) }).lean();
  if (!existing) return error(res, "Secretary not found", 404);
  if (!canManageDoctor(req.user, existing.doctorUserId)) return error(res, "You cannot invite this secretary", 403);
  const token = randomBytes(32).toString("hex");
  const item = await Secretary.findOneAndUpdate(
    { userId: Number(req.params.secretaryUserId) },
    {
      status: "INVITED",
      invitationToken: token,
      invitationExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    },
    { new: true },
  );
  if (!item) return error(res, "Secretary not found", 404);
  return success(res, item, "Secretary invitation created");
}

async function invitationInfo(req, res) {
  const invitationToken = String(req.query.invitationToken || "");
  if (!invitationToken) return error(res, "Invitation token is required", 400);
  const item = await Secretary.findOne({
    invitationToken,
    status: "INVITED",
    invitationExpiresAt: { $gt: new Date() },
  }).select("firstName lastName email gender phoneNumber").lean();
  if (!item) return error(res, "Invitation is invalid or has expired", 404);
  return success(res, item, "Invitation info fetched");
}

async function onboard(req, res) {
  const invitationToken = String(req.query.invitationToken || "");
  const { firstName, lastName, gender, email, countryCode, mobileNumber, password } = req.body;
  if (!invitationToken) return error(res, "Invitation token is required", 400);
  if (!firstName || !email || !mobileNumber || !password) {
    return error(res, "First name, email, mobile number, and password are required", 422);
  }
  if (String(password).length < 8) return error(res, "Password must be at least 8 characters", 422);

  const item = await Secretary.findOne({
    invitationToken,
    status: "INVITED",
    invitationExpiresAt: { $gt: new Date() },
  });
  if (!item) return error(res, "Invitation is invalid or has expired", 404);

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedCountryCode = String(countryCode || "+880").trim();
  const normalizedMobileNumber = String(mobileNumber).trim();
  const duplicate = await User.findOne({
    $or: [
      { email: normalizedEmail },
      { countryCode: normalizedCountryCode, mobileNumber: normalizedMobileNumber },
    ],
  }).lean();
  if (duplicate) return error(res, "An account already exists with this email or phone number", 409);

  await User.create({
    id: item.userId,
    firstName,
    lastName,
    gender,
    email: normalizedEmail,
    countryCode: normalizedCountryCode,
    mobileNumber: normalizedMobileNumber,
    passwordHash: await bcrypt.hash(String(password), 12),
    userType: "SECRETARY",
    status: "ACTIVE",
    roles: [{ roleName: "SECRETARY", roleType: "SECRETARY" }],
  });

  item.set({
    firstName,
    lastName,
    gender,
    email: normalizedEmail,
    phoneNumber: `${normalizedCountryCode}${normalizedMobileNumber}`,
    status: "ACTIVE",
    invitationToken: undefined,
    invitationExpiresAt: undefined,
  });
  await item.save();
  return success(res, item, "Secretary onboarded");
}

async function getByUserId(req, res) {
  const requestedUserId = Number(req.params.userId);
  if (!isAdmin(req.user) && requestedUserId !== Number(req.user.id)) {
    const record = await Secretary.findOne({ userId: requestedUserId }).select("doctorUserId").lean();
    if (!record || !canManageDoctor(req.user, record.doctorUserId)) return error(res, "You cannot access this secretary", 403);
  }
  const item = await Secretary.findOne({ userId: Number(req.params.userId) }).lean();
  if (!item) return error(res, "Secretary not found", 404);
  return success(res, item, "Secretary fetched");
}

async function byDoctorUserId(req, res) {
  if (!canManageDoctor(req.user, req.params.doctorUserId)) return error(res, "You cannot access another doctor's secretaries", 403);
  const { page, limit, skip } = pagination(req);
  const filter = { doctorUserId: Number(req.params.doctorUserId) };
  const [items, total] = await Promise.all([
    Secretary.find(filter).skip(skip).limit(limit).lean(),
    Secretary.countDocuments(filter),
  ]);
  return success(res, paginated(items, page, limit, total), "Secretaries fetched");
}

async function remove(req, res) {
  const item = await Secretary.findOne({ userId: Number(req.params.userId) }).lean();
  if (!item) return error(res, "Secretary not found", 404);
  if (!canManageDoctor(req.user, item.doctorUserId)) return error(res, "You cannot delete this secretary", 403);
  await Secretary.deleteOne({ userId: item.userId });
  return success(res, null, "Secretary deleted");
}

async function assignLocation(req, res) {
  const secretary = await Secretary.findOne({ userId: Number(req.body.userId) }).lean();
  if (!secretary) return error(res, "Secretary not found", 404);
  if (!canManageDoctor(req.user, secretary.doctorUserId)) return error(res, "You cannot assign locations to this secretary", 403);
  const location = await Location.findOne({ id: Number(req.body.locationId) }).lean();
  const doctor = req.body.doctorId ? await Doctor.findOne({ id: Number(req.body.doctorId) }).lean() : null;
  const item = await SecretaryLocation.create({
    ...req.body,
    id: await nextId("secretaryLocations"),
    locationName: req.body.locationName || location?.locationName,
    city: req.body.city || location?.city,
    doctorName: req.body.doctorName || (doctor ? `${doctor.firstName} ${doctor.lastName}`.trim() : undefined),
  });
  return success(res, item, "Location assigned", 201);
}

async function removeLocation(req, res) {
  const secretary = await Secretary.findOne({ userId: Number(req.body.userId) }).lean();
  if (!secretary) return error(res, "Secretary not found", 404);
  if (!canManageDoctor(req.user, secretary.doctorUserId)) return error(res, "You cannot remove locations from this secretary", 403);
  await SecretaryLocation.deleteOne({ userId: Number(req.body.userId), locationId: Number(req.body.locationId) });
  return success(res, null, "Location removed");
}

async function locationsBySecretary(req, res) {
  const secretary = await Secretary.findOne({ userId: Number(req.params.userId) }).lean();
  if (!secretary) return error(res, "Secretary not found", 404);
  if (Number(req.user.id) !== Number(secretary.userId) && !canManageDoctor(req.user, secretary.doctorUserId)) {
    return error(res, "You cannot access this secretary's locations", 403);
  }
  const items = await SecretaryLocation.find({ userId: Number(req.params.userId) }).lean();
  return success(res, items, "Secretary locations fetched");
}

async function updateLocation(req, res) {
  const secretary = await Secretary.findOne({ userId: Number(req.body.userId) }).lean();
  if (!secretary) return error(res, "Secretary not found", 404);
  if (!canManageDoctor(req.user, secretary.doctorUserId)) return error(res, "You cannot update this secretary's locations", 403);
  const item = await SecretaryLocation.findOneAndUpdate(
    { userId: Number(req.body.userId), locationId: Number(req.body.locationId) },
    req.body,
    { new: true },
  );
  if (!item) return error(res, "Secretary location not found", 404);
  return success(res, item, "Secretary location updated");
}

module.exports = {
  create,
  invite,
  invitationInfo,
  onboard,
  getByUserId,
  byDoctorUserId,
  remove,
  assignLocation,
  removeLocation,
  locationsBySecretary,
  updateLocation,
};

