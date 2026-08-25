const Secretary = require("../models/Secretary");
const SecretaryLocation = require("../models/SecretaryLocation");
const Location = require("../models/Location");
const Doctor = require("../models/Doctor");
const { success, error, paginated } = require("../utils/apiResponse");
const { pagination } = require("../utils/query");
const { nextId } = require("../utils/ids");

async function create(req, res) {
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
  const item = await Secretary.findOneAndUpdate(
    { userId: Number(req.params.secretaryUserId) },
    { status: "INVITED", invitationToken: `secretary-${Date.now()}` },
    { new: true },
  );
  if (!item) return error(res, "Secretary not found", 404);
  return success(res, item, "Secretary invited");
}

async function invitationInfo(_req, res) {
  return success(res, { firstName: "Invited", lastName: "Secretary", email: "secretary@example.com" }, "Invitation info fetched");
}

async function onboard(req, res) {
  const item = await Secretary.findOneAndUpdate({ userId: Number(req.body.userId) }, { ...req.body, status: "ACTIVE" }, { new: true });
  if (!item) return error(res, "Secretary not found", 404);
  return success(res, item, "Secretary onboarded");
}

async function getByUserId(req, res) {
  const item = await Secretary.findOne({ userId: Number(req.params.userId) }).lean();
  if (!item) return error(res, "Secretary not found", 404);
  return success(res, item, "Secretary fetched");
}

async function byDoctorUserId(req, res) {
  const { page, limit, skip } = pagination(req);
  const filter = { doctorUserId: Number(req.params.doctorUserId) };
  const [items, total] = await Promise.all([
    Secretary.find(filter).skip(skip).limit(limit).lean(),
    Secretary.countDocuments(filter),
  ]);
  return success(res, paginated(items, page, limit, total), "Secretaries fetched");
}

async function remove(req, res) {
  await Secretary.deleteOne({ userId: Number(req.params.userId) });
  return success(res, null, "Secretary deleted");
}

async function assignLocation(req, res) {
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
  await SecretaryLocation.deleteOne({ userId: Number(req.body.userId), locationId: Number(req.body.locationId) });
  return success(res, null, "Location removed");
}

async function locationsBySecretary(req, res) {
  const items = await SecretaryLocation.find({ userId: Number(req.params.userId) }).lean();
  return success(res, items, "Secretary locations fetched");
}

async function updateLocation(req, res) {
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

