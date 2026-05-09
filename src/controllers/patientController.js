const Patient = require("../models/Patient");
const Beneficiary = require("../models/Beneficiary");
const { success, error, paginated } = require("../utils/apiResponse");
const { pagination, textSearch } = require("../utils/query");
const { nextId } = require("../utils/ids");

async function getByUserId(req, res) {
  const patient = await Patient.findOne({ userId: Number(req.params.userId) }).lean();
  if (!patient) return error(res, "Patient not found", 404);
  return success(res, patient, "Patient fetched");
}

async function update(req, res) {
  const patient = await Patient.findOneAndUpdate({ userId: Number(req.body.userId) }, req.body, { new: true });
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
  const filter = req.query.patientUserId ? { patientUserId: Number(req.query.patientUserId) } : {};
  const [items, total] = await Promise.all([
    Beneficiary.find(filter).skip(skip).limit(limit).lean(),
    Beneficiary.countDocuments(filter),
  ]);
  return success(res, paginated(items, page, limit, total), "Beneficiaries fetched");
}

async function addBeneficiary(req, res) {
  const item = await Beneficiary.create({ ...req.body, id: await nextId("beneficiaries") });
  return success(res, item, "Beneficiary added", 201);
}

async function deleteBeneficiary(req, res) {
  await Beneficiary.deleteOne({ id: Number(req.params.id) });
  return success(res, null, "Beneficiary deleted");
}

module.exports = { getByUserId, update, searchPatients, beneficiaries, addBeneficiary, deleteBeneficiary };
