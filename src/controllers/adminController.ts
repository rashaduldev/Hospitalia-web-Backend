const Speciality = require("../models/Speciality");
const Role = require("../models/Role");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const Hospital = require("../models/Hospital");
const Appointment = require("../models/Appointment");
const { success, error, paginated } = require("../utils/apiResponse");
const { pagination } = require("../utils/query");
const { nextId } = require("../utils/ids");

const privileges = [
  { id: 1, name: "USER_READ", descName: "Read users" },
  { id: 2, name: "USER_WRITE", descName: "Create and update users" },
  { id: 3, name: "APPOINTMENT_READ", descName: "Read appointments" },
  { id: 4, name: "SYSTEM_ADMIN", descName: "Manage platform settings" },
];

async function dashboard(_req, res) {
  const [users, doctors, patients, hospitals, appointments] = await Promise.all([
    User.countDocuments(),
    Doctor.countDocuments(),
    Patient.countDocuments(),
    Hospital.countDocuments(),
    Appointment.countDocuments(),
  ]);
  return success(res, { users, doctors, patients, hospitals, appointments }, "Dashboard stats fetched");
}

async function allSpecialities(_req, res) {
  const items = await Speciality.find().sort({ name: 1 }).lean();
  return success(res, items, "Specialities fetched");
}

async function createSpeciality(req, res) {
  const item = await Speciality.create({ ...req.body, id: await nextId("specialities") });
  return success(res, item, "Speciality created", 201);
}

async function updateSpeciality(req, res) {
  const id = Number(req.params.id || String(req.originalUrl).split("id").pop());
  const item = await Speciality.findOneAndUpdate({ id }, req.body, { new: true });
  if (!item) return error(res, "Speciality not found", 404);
  return success(res, item, "Speciality updated");
}

async function deleteSpeciality(req, res) {
  await Speciality.deleteOne({ id: Number(req.params.id) });
  return success(res, null, "Speciality deleted");
}

async function getSpeciality(req, res) {
  const item = await Speciality.findOne({ id: Number(req.params.id) }).lean();
  if (!item) return error(res, "Speciality not found", 404);
  return success(res, item, "Speciality fetched");
}

async function listRoles(req, res) {
  const { page, limit, skip } = pagination(req);
  const [items, total] = await Promise.all([
    Role.find().skip(skip).limit(limit).lean(),
    Role.countDocuments(),
  ]);
  return success(res, paginated(items, page, limit, total), "Roles fetched");
}

async function getRole(req, res) {
  const role = await Role.findOne({ id: Number(req.params.id) }).lean();
  if (!role) return error(res, "Role not found", 404);
  return success(res, role, "Role fetched");
}

async function roleTypes(_req, res) {
  return success(res, ["SUPER_ADMIN", "ADMIN", "DOCTOR", "HOSPITAL", "PATIENT", "SECRETARY"], "Role types fetched");
}

async function listPrivileges(_req, res) {
  return success(res, privileges, "Privileges fetched");
}

async function createRole(req, res) {
  const role = await Role.create({ ...req.body, id: await nextId("roles") });
  return success(res, role, "Role created", 201);
}

async function updateRole(req, res) {
  const role = await Role.findOneAndUpdate({ id: Number(req.body.id) }, req.body, { new: true });
  if (!role) return error(res, "Role not found", 404);
  return success(res, role, "Role updated");
}

async function deleteRole(req, res) {
  await Role.deleteOne({ id: Number(req.params.id) });
  return success(res, null, "Role deleted");
}

module.exports = {
  dashboard,
  allSpecialities,
  createSpeciality,
  updateSpeciality,
  deleteSpeciality,
  getSpeciality,
  listRoles,
  getRole,
  roleTypes,
  listPrivileges,
  createRole,
  updateRole,
  deleteRole,
};

