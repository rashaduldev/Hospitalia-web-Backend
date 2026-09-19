const Hospital = require("../models/Hospital");
const Location = require("../models/Location");
const HospitalDoctor = require("../models/HospitalDoctor");
const Doctor = require("../models/Doctor");
const { success, error, paginated } = require("../utils/apiResponse");
const { pagination } = require("../utils/query");
const { nextId } = require("../utils/ids");

function isAdmin(user) {
  return user?.userType === "ADMIN" || (user?.roles || []).some((role) => role.roleType === "SUPER_ADMIN");
}

async function canManageHospital(user, hospitalId) {
  if (isAdmin(user)) return true;
  const hospital = await Hospital.findOne({ $or: [{ id: Number(hospitalId) }, { userId: Number(hospitalId) }] }).select("userId").lean();
  return Boolean(hospital && Number(hospital.userId) === Number(user?.id));
}

async function getById(req, res) {
  const hospital = await Hospital.findOne({ id: Number(req.params.id) }).lean();
  if (!hospital) return error(res, "Hospital not found", 404);
  return success(res, hospital, "Hospital fetched");
}

async function getByUserId(req, res) {
  const requestedUserId = Number(req.params.hospitalUserId || req.params.userId);
  if (!isAdmin(req.user) && requestedUserId !== Number(req.user.id)) return error(res, "You cannot access another hospital account", 403);
  const hospital = await Hospital.findOne({ userId: requestedUserId }).lean();
  if (!hospital) return error(res, "Hospital not found", 404);
  return success(res, hospital, "Hospital fetched");
}

async function paginatedByUser(req, res) {
  if (!isAdmin(req.user) && Number(req.params.userId) !== Number(req.user.id)) return error(res, "You cannot access another hospital account", 403);
  const { page, limit, skip } = pagination(req);
  const [items, total] = await Promise.all([
    Hospital.find({ userId: Number(req.params.userId) }).skip(skip).limit(limit).lean(),
    Hospital.countDocuments({ userId: Number(req.params.userId) }),
  ]);
  return success(res, paginated(items, page, limit, total), "Hospitals fetched");
}

async function create(req, res) {
  const userId = isAdmin(req.user) ? Number(req.body.userId) : Number(req.user.id);
  const hospital = await Hospital.create({ ...req.body, userId, id: await nextId("hospitals") });
  return success(res, hospital, "Hospital created", 201);
}

async function update(req, res) {
  if (!(await canManageHospital(req.user, req.params.id))) return error(res, "You cannot update this hospital", 403);
  const hospital = await Hospital.findOneAndUpdate({ id: Number(req.params.id) }, req.body, { new: true });
  if (!hospital) return error(res, "Hospital not found", 404);
  return success(res, hospital, "Hospital updated");
}

async function remove(req, res) {
  if (!(await canManageHospital(req.user, req.params.id))) return error(res, "You cannot delete this hospital", 403);
  await Hospital.deleteOne({ id: Number(req.params.id) });
  return success(res, null, "Hospital deleted");
}

async function locations(req, res) {
  const hospitalId = Number(req.params.hospitalId);
  if (!(await canManageHospital(req.user, hospitalId))) return error(res, "You cannot access these locations", 403);
  const items = await Location.find({ $or: [{ hospitalId }, { hospitalUserId: hospitalId }] }).lean();
  return success(res, items, "Hospital locations fetched");
}

async function createLocation(req, res) {
  if (!(await canManageHospital(req.user, req.body.hospitalId || req.body.hospitalUserId))) return error(res, "You cannot create a location for this hospital", 403);
  const item = await Location.create({ ...req.body, id: await nextId("locations") });
  return success(res, item, "Hospital location created", 201);
}

async function updateLocation(req, res) {
  const id = Number(req.body.id || req.body.locationId);
  const existing = await Location.findOne({ id }).lean();
  if (!existing) return error(res, "Location not found", 404);
  if (!(await canManageHospital(req.user, existing.hospitalId || existing.hospitalUserId))) return error(res, "You cannot update this location", 403);
  const item = await Location.findOneAndUpdate({ id }, req.body, { new: true });
  if (!item) return error(res, "Location not found", 404);
  return success(res, item, "Hospital location updated");
}

async function deleteLocation(req, res) {
  const item = await Location.findOne({ id: Number(req.params.locationId) }).lean();
  if (!item) return error(res, "Location not found", 404);
  if (!(await canManageHospital(req.user, item.hospitalId || item.hospitalUserId))) return error(res, "You cannot delete this location", 403);
  await Location.deleteOne({ id: item.id });
  return success(res, null, "Hospital location deleted");
}

async function hospitalDoctors(req, res) {
  const links = await HospitalDoctor.find({ hospitalId: Number(req.params.hospitalId) }).lean();
  const doctors = await Doctor.find({ id: { $in: links.map((link) => link.doctorId) } }).lean();
  return success(res, doctors, "Hospital doctors fetched");
}

async function assignDoctor(req, res) {
  if (!(await canManageHospital(req.user, req.body.hospitalId))) return error(res, "You cannot assign doctors to this hospital", 403);
  const item = await HospitalDoctor.create({ ...req.body, id: await nextId("hospitalDoctors") });
  return success(res, item, "Doctor assigned", 201);
}

async function unassignDoctor(req, res) {
  const item = await HospitalDoctor.findOne({ id: Number(req.params.id) }).lean();
  if (!item) return error(res, "Hospital doctor assignment not found", 404);
  if (!(await canManageHospital(req.user, item.hospitalId))) return error(res, "You cannot remove doctors from this hospital", 403);
  await HospitalDoctor.deleteOne({ id: item.id });
  return success(res, null, "Doctor unassigned");
}

module.exports = {
  getById,
  getByUserId,
  paginatedByUser,
  create,
  update,
  remove,
  locations,
  createLocation,
  updateLocation,
  deleteLocation,
  hospitalDoctors,
  assignDoctor,
  unassignDoctor,
};

