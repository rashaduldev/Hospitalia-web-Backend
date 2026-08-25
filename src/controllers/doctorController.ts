const Doctor = require("../models/Doctor");
const Location = require("../models/Location");
const Availability = require("../models/Availability");
const UnavailableDate = require("../models/UnavailableDate");
const Appointment = require("../models/Appointment");
const Speciality = require("../models/Speciality");
const { success, error, paginated } = require("../utils/apiResponse");
const { pagination, textSearch } = require("../utils/query");
const { nextId } = require("../utils/ids");
const { ensureDefaultSpecialities } = require("../utils/defaultSpecialities");

async function listDoctors(req, res) {
  const { page, limit, skip } = pagination(req);
  const filter = textSearch(req.query.search || req.query.keyword, ["firstName", "lastName", "email", "professionalInfoResponse.designation"]);
  const [items, total] = await Promise.all([
    Doctor.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Doctor.countDocuments(filter),
  ]);
  return success(res, paginated(items, page, limit, total), "Doctors fetched");
}

async function getDoctorByUserId(req, res) {
  const doctor = await Doctor.findOne({ userId: Number(req.params.userId || req.params.SignleDoctorUserId) }).lean();
  if (!doctor) return error(res, "Doctor not found", 404);
  return success(res, doctor, "Doctor fetched");
}

async function getDoctorById(req, res) {
  const doctor = await Doctor.findOne({ id: Number(req.params.id || req.params.doctorId) }).lean();
  if (!doctor) return error(res, "Doctor not found", 404);
  return success(res, doctor, "Doctor fetched");
}

async function updateDoctor(req, res) {
  const userId = Number(req.body.userId);
  const update = {
    ...req.body,
    phoneNumber: req.body.mobileNumber ? `${req.body.countryCode || ""}${req.body.mobileNumber}` : req.body.phoneNumber,
  };
  if (req.body.professionalInfoRequest) {
    await ensureDefaultSpecialities();
    const specialityIds = [...new Set<number>((req.body.professionalInfoRequest.specialityId || []).map((value) => Number(value)))]
      .filter((id) => Number.isInteger(id) && id > 0);
    const specialities = await Speciality.find({ id: { $in: specialityIds }, status: "ACTIVE" })
      .select("id name -_id")
      .lean();
    if (specialities.length !== specialityIds.length) {
      return error(res, "One or more selected specialities are invalid or inactive", 422);
    }
    update.professionalInfoResponse = {
      designation: req.body.professionalInfoRequest.designation,
      onmsRegistrationNumber: req.body.professionalInfoRequest.onmsRegistrationNumber,
      professionalStatement: req.body.professionalInfoRequest.professionalStatement,
      workPhoneNumber: req.body.professionalInfoRequest.workPhoneNumber,
      specialities,
    };
  }
  const doctor = await Doctor.findOneAndUpdate({ userId }, update, { new: true });
  if (!doctor) return error(res, "Doctor not found", 404);
  return success(res, doctor, "Doctor updated");
}

async function importedBy(req, res) {
  const doctors = await Doctor.find({ importedByUserId: Number(req.params.userId) }).lean();
  return success(res, { content: doctors }, "Imported doctors fetched");
}

async function invitationInfo(_req, res) {
  return success(res, { firstName: "Invited", lastName: "Doctor", email: "doctor@example.com" }, "Invitation info fetched");
}

async function onboard(req, res) {
  return updateDoctor(req, res);
}

async function invite(req, res) {
  const doctor = await Doctor.findOneAndUpdate(
    { id: Number(req.params.doctorId) },
    { status: "INVITED", invitationToken: `doctor-${Date.now()}` },
    { new: true },
  );
  if (!doctor) return error(res, "Doctor not found", 404);
  return success(res, doctor, "Doctor invited");
}

async function locationsByDoctor(req, res) {
  const doctorId = Number(req.params.doctorId);
  const locations = await Location.find({ $or: [{ doctorId }, { doctorUserId: doctorId }] }).sort({ createdAt: -1 }).lean();
  return success(res, locations, "Doctor locations fetched");
}

async function getLocation(req, res) {
  const location = await Location.findOne({ id: Number(req.params.locationId) }).lean();
  if (!location) return error(res, "Location not found", 404);
  return success(res, location, "Location fetched");
}

async function createLocation(req, res) {
  const location = await Location.create({ ...req.body, id: await nextId("locations") });
  return success(res, location, "Location created", 201);
}

async function updateLocation(req, res) {
  const id = Number(req.body.id || req.body.locationId);
  const location = await Location.findOneAndUpdate({ id }, req.body, { new: true });
  if (!location) return error(res, "Location not found", 404);
  return success(res, location, "Location updated");
}

async function deleteLocation(req, res) {
  await Location.deleteOne({ id: Number(req.params.locationId) });
  return success(res, null, "Location deleted");
}

async function availabilityByDoctor(req, res) {
  const doctorId = Number(req.params.doctorId);
  const query = { doctorId, ...(req.params.doctorLocationId ? { doctorLocationId: Number(req.params.doctorLocationId) } : {}) };
  const items = await Availability.find(query).sort({ dayOfWeek: 1, startTime: 1 }).lean();
  return success(res, items, "Availability fetched");
}

async function createAvailability(req, res) {
  const rows = Array.isArray(req.body)
    ? req.body
    : req.body.availabilitySlots || req.body.slots || req.body.weeklySchedule || [req.body];
  const created = [];
  for (const row of rows) {
    const timeSlot = String(row.timeSlot || "");
    const slotDuration = Number(row.slotDuration) || ({
      MIN_10: 10, MIN_15: 15, MIN_30: 30, HOUR_1: 60, MIN_90: 90, HOUR_2: 120,
    }[timeSlot] || 30);
    created.push(await Availability.create({
      ...row,
      doctorId: Number(row.doctorId || req.body.doctorId),
      slotDuration,
      status: row.status || (row.availabilityStatus === "UNAVAILABLE" ? "INACTIVE" : "ACTIVE"),
      id: await nextId("availability"),
    }));
  }
  return success(res, created.length === 1 ? created[0] : created, "Availability created", 201);
}

async function updateAvailability(req, res) {
  const id = Number(req.body.id || req.body.availabilityIds?.[0]);
  const schedule = req.body.weeklySchedule?.[0] || req.body;
  const timeSlot = String(schedule.timeSlot || "");
  const slotDuration = Number(schedule.slotDuration) || ({
    MIN_10: 10, MIN_15: 15, MIN_30: 30, HOUR_1: 60, MIN_90: 90, HOUR_2: 120,
  }[timeSlot] || undefined);
  const item = await Availability.findOneAndUpdate(
    { id },
    {
      ...schedule,
      ...(slotDuration ? { slotDuration } : {}),
      status: schedule.status || (schedule.availabilityStatus === "UNAVAILABLE" ? "INACTIVE" : "ACTIVE"),
    },
    { new: true },
  );
  if (!item) return error(res, "Availability not found", 404);
  return success(res, item, "Availability updated");
}

async function deleteAvailability(req, res) {
  await Availability.deleteOne({ id: Number(req.params.id) });
  return success(res, null, "Availability deleted");
}

async function defaultTimeSlots(_req, res) {
  return success(res, ["MIN_10", "MIN_15", "MIN_30", "HOUR_1", "MIN_90", "HOUR_2"], "Default slots fetched");
}

async function unavailabilityByDoctor(req, res) {
  const items = await UnavailableDate.find({ doctorId: Number(req.params.doctorId) }).sort({ unavailableDate: 1 }).lean();
  return success(res, items, "Unavailable dates fetched");
}

async function createUnavailability(req, res) {
  const item = await UnavailableDate.create({ ...req.body, id: await nextId("unavailableDates") });
  return success(res, item, "Unavailable date created", 201);
}

async function updateUnavailability(req, res) {
  const item = await UnavailableDate.findOneAndUpdate({ id: Number(req.body.id) }, req.body, { new: true });
  if (!item) return error(res, "Unavailable date not found", 404);
  return success(res, item, "Unavailable date updated");
}

async function deleteUnavailability(req, res) {
  await UnavailableDate.deleteOne({ id: Number(req.params.id) });
  return success(res, null, "Unavailable date deleted");
}

async function appointmentTypes(_req, res) {
  return success(res, [
    { id: 1, name: "Consultation", durationMinutes: 30 },
    { id: 2, name: "Follow-up", durationMinutes: 15 },
  ], "Appointment types fetched");
}

async function specialities(_req, res) {
  await ensureDefaultSpecialities();
  const items = await Speciality.find({ status: "ACTIVE" }).sort({ name: 1 }).lean();
  return success(res, paginated(items, 0, items.length || 10, items.length), "Specialities fetched");
}

module.exports = {
  listDoctors,
  getDoctorByUserId,
  getDoctorById,
  updateDoctor,
  importedBy,
  invitationInfo,
  onboard,
  invite,
  locationsByDoctor,
  getLocation,
  createLocation,
  updateLocation,
  deleteLocation,
  availabilityByDoctor,
  createAvailability,
  updateAvailability,
  deleteAvailability,
  defaultTimeSlots,
  unavailabilityByDoctor,
  createUnavailability,
  updateUnavailability,
  deleteUnavailability,
  appointmentTypes,
  specialities,
};

