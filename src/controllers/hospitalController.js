const Hospital = require("../models/Hospital");
const Location = require("../models/Location");
const HospitalDoctor = require("../models/HospitalDoctor");
const Doctor = require("../models/Doctor");
const { success, error, paginated } = require("../utils/apiResponse");
const { pagination } = require("../utils/query");
const { nextId } = require("../utils/ids");

async function getById(req, res) {
  const hospital = await Hospital.findOne({ id: Number(req.params.id) }).lean();
  if (!hospital) return error(res, "Hospital not found", 404);
  return success(res, hospital, "Hospital fetched");
}

async function getByUserId(req, res) {
  const hospital = await Hospital.findOne({ userId: Number(req.params.hospitalUserId || req.params.userId) }).lean();
  if (!hospital) return error(res, "Hospital not found", 404);
  return success(res, hospital, "Hospital fetched");
}

async function paginatedByUser(req, res) {
  const { page, limit, skip } = pagination(req);
  const [items, total] = await Promise.all([
    Hospital.find({ userId: Number(req.params.userId) }).skip(skip).limit(limit).lean(),
    Hospital.countDocuments({ userId: Number(req.params.userId) }),
  ]);
  return success(res, paginated(items, page, limit, total), "Hospitals fetched");
}

async function create(req, res) {
  const hospital = await Hospital.create({ ...req.body, id: await nextId("hospitals") });
  return success(res, hospital, "Hospital created", 201);
}

async function update(req, res) {
  const hospital = await Hospital.findOneAndUpdate({ id: Number(req.params.id) }, req.body, { new: true });
  if (!hospital) return error(res, "Hospital not found", 404);
  return success(res, hospital, "Hospital updated");
}

async function remove(req, res) {
  await Hospital.deleteOne({ id: Number(req.params.id) });
  return success(res, null, "Hospital deleted");
}

async function locations(req, res) {
  const hospitalId = Number(req.params.hospitalId);
  const items = await Location.find({ $or: [{ hospitalId }, { hospitalUserId: hospitalId }] }).lean();
  return success(res, items, "Hospital locations fetched");
}

async function createLocation(req, res) {
  const item = await Location.create({ ...req.body, id: await nextId("locations") });
  return success(res, item, "Hospital location created", 201);
}

async function updateLocation(req, res) {
  const item = await Location.findOneAndUpdate({ id: Number(req.body.id || req.body.locationId) }, req.body, { new: true });
  if (!item) return error(res, "Location not found", 404);
  return success(res, item, "Hospital location updated");
}

async function deleteLocation(req, res) {
  await Location.deleteOne({ id: Number(req.params.locationId) });
  return success(res, null, "Hospital location deleted");
}

async function hospitalDoctors(req, res) {
  const links = await HospitalDoctor.find({ hospitalId: Number(req.params.hospitalId) }).lean();
  const doctors = await Doctor.find({ id: { $in: links.map((link) => link.doctorId) } }).lean();
  return success(res, doctors, "Hospital doctors fetched");
}

async function assignDoctor(req, res) {
  const item = await HospitalDoctor.create({ ...req.body, id: await nextId("hospitalDoctors") });
  return success(res, item, "Doctor assigned", 201);
}

async function unassignDoctor(req, res) {
  await HospitalDoctor.deleteOne({ id: Number(req.params.id) });
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
