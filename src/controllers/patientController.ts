const Patient = require("../models/Patient");
const Beneficiary = require("../models/Beneficiary");
const { success, error, paginated } = require("../utils/apiResponse");
const { pagination, textSearch } = require("../utils/query");
const { nextId } = require("../utils/ids");

function isAdmin(user) {
  return user?.userType === "ADMIN" || (user?.roles || []).some((role) => role.roleType === "SUPER_ADMIN");
}

async function getByUserId(req, res) {
  if (req.user.userType === "PATIENT" && Number(req.params.userId) !== Number(req.user.id)) {
    return error(res, "You cannot access another patient", 403);
  }
  const patient = await Patient.findOne({ userId: Number(req.params.userId) }).lean();
  if (!patient) return error(res, "Patient not found", 404);
  return success(res, patient, "Patient fetched");
}

async function update(req, res) {
  const userId = Number(req.body.userId || req.user.id);
  if (!isAdmin(req.user) && userId !== Number(req.user.id)) return error(res, "You cannot update another patient", 403);
  const patient = await Patient.findOneAndUpdate({ userId }, { ...req.body, userId }, { new: true });
  if (!patient) return error(res, "Patient not found", 404);
  return success(res, patient, "Patient updated");
}

async function searchPatients(req, res) {
  const { page, limit, skip } = pagination(req);
  const filter = textSearch(req.query.search || req.query.keyword, ["firstName", "lastName", "email", "mobileNumber"]);
  const [items, total] = await Promise.all([
    Patient.find(filter).skip(skip).limit(limit).lean(),
    Patient.countDocuments(filter),
  ]);
  return success(res, paginated(items, page, limit, total), "Patients fetched");
}

async function beneficiaries(req, res) {
  const { page, limit, skip } = pagination(req);
  const filter = { patientUserId: Number(req.user.id) };
  const [items, total] = await Promise.all([
    Beneficiary.find(filter).skip(skip).limit(limit).lean(),
    Beneficiary.countDocuments(filter),
  ]);
  return success(res, paginated(items, page, limit, total), "Beneficiaries fetched");
}

async function addBeneficiary(req, res) {
  const item = await Beneficiary.create({ ...req.body, patientUserId: Number(req.user.id), id: await nextId("beneficiaries") });
  return success(res, item, "Beneficiary added", 201);
}

async function deleteBeneficiary(req, res) {
  const result = await Beneficiary.deleteOne({ id: Number(req.params.id), patientUserId: Number(req.user.id) });
  if (!result.deletedCount) return error(res, "Beneficiary not found", 404);
  return success(res, null, "Beneficiary deleted");
}

module.exports = { getByUserId, update, searchPatients, beneficiaries, addBeneficiary, deleteBeneficiary };

