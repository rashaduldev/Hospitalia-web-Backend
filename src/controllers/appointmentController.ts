const Appointment = require("../models/Appointment");
const Availability = require("../models/Availability");
const Location = require("../models/Location");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const { success, error, paginated } = require("../utils/apiResponse");
const { pagination, todayIso } = require("../utils/query");
const { nextId } = require("../utils/ids");

async function availableSlots(req, res) {
  const doctorId = Number(req.params.doctorId);
  const locationId = Number(req.params.doctorLocationId);
  const date = req.query.date || req.query.appointmentDate;
  const dayName = date ? new Date(date).toLocaleDateString("en-US", { weekday: "long" }).toUpperCase() : undefined;
  const availability = await Availability.find({
    doctorId,
    doctorLocationId: locationId,
    status: "ACTIVE",
    ...(dayName ? { dayOfWeek: { $in: [dayName, dayName.toLowerCase(), dayName[0] + dayName.slice(1).toLowerCase()] } } : {}),
  }).lean();
  const booked = await Appointment.find({ doctorId, locationId, appointmentDate: date, appointmentStatus: { $ne: "CANCELLED" } }).lean();
  const slots = availability.map((slot) => ({
    locationId,
    startTime: slot.startTime,
    endTime: slot.endTime,
    slotDuration: slot.slotDuration,
    fees: slot.fees,
    available: !booked.some((item) => item.startTime === slot.startTime),
  }));
  return success(res, slots, "Available slots fetched");
}

async function book(req, res) {
  const slot = req.body.appointmentSlotDto || {};
  const doctor = await Doctor.findOne({ $or: [{ id: Number(req.body.doctorId) }, { userId: Number(req.body.doctorId) }] }).lean();
  const patient = req.body.patientUserId ? await Patient.findOne({ userId: Number(req.body.patientUserId) }).lean() : null;
  const location = await Location.findOne({ id: Number(slot.locationId) }).lean();
  if (!doctor) return error(res, "Doctor not found", 404);

  const appointment = await Appointment.create({
    appointmentId: await nextId("appointments"),
    doctorId: doctor.id,
    doctorUserId: doctor.userId,
    patientUserId: req.body.patientUserId,
    appointmentTypeId: req.body.appointmentTypeId,
    doctorName: `${doctor.firstName || ""} ${doctor.lastName || ""}`.trim(),
    designation: doctor.professionalInfoResponse?.designation,
    patientName: req.body.patientName || `${patient?.firstName || ""} ${patient?.lastName || ""}`.trim(),
    patientGender: req.body.patientGender || patient?.gender,
    patientAge: req.body.patientAge,
    patientPhone: req.body.patientPhone || patient?.mobileNumber,
    patientEmail: req.body.patientEmail || patient?.email,
    appointmentDate: req.body.appointmentDate,
    dayOfWeek: req.body.dayOfWeek,
    locationId: slot.locationId,
    locationName: location?.locationName,
    startTime: slot.startTime,
    endTime: slot.endTime,
    slotDuration: slot.slotDuration,
    fees: req.body.fees || location?.fees || 0,
    notes: req.body.notes,
    bookingSource: req.body.bookingSource || "PATIENT",
    bookedByUserId: req.body.bookedByUserId || req.body.patientUserId,
  });
  return success(res, appointment, "Appointment booked", 201);
}

async function listAppointments(filter, req, res, message) {
  const { page, limit, skip } = pagination(req);
  const [items, total] = await Promise.all([
    Appointment.find(filter).sort({ appointmentDate: 1, startTime: 1 }).skip(skip).limit(limit).lean(),
    Appointment.countDocuments(filter),
  ]);
  return success(res, paginated(items, page, limit, total), message);
}

async function upcomingByDoctor(req, res) {
  return listAppointments({ doctorId: Number(req.params.doctorId), appointmentDate: { $gte: todayIso() }, appointmentStatus: { $ne: "CANCELLED" } }, req, res, "Upcoming appointments fetched");
}

async function todayByDoctor(req, res) {
  return listAppointments({ doctorId: Number(req.params.doctorId), appointmentDate: todayIso(), appointmentStatus: { $ne: "CANCELLED" } }, req, res, "Today's appointments fetched");
}

async function pastByDoctor(req, res) {
  return listAppointments({ doctorId: Number(req.params.doctorId), appointmentDate: { $lt: todayIso() } }, req, res, "Past appointments fetched");
}

async function upcomingByPatient(req, res) {
  return listAppointments({ patientUserId: Number(req.params.patientUserId), appointmentDate: { $gte: todayIso() }, appointmentStatus: { $ne: "CANCELLED" } }, req, res, "Upcoming appointments fetched");
}

async function pastByPatient(req, res) {
  return listAppointments({ patientUserId: Number(req.params.patientUserId), appointmentDate: { $lt: todayIso() } }, req, res, "Past appointments fetched");
}

async function byDoctorLocation(req, res) {
  return listAppointments({ doctorId: Number(req.params.doctorId), locationId: Number(req.params.locationId), appointmentDate: { $gte: todayIso() } }, req, res, "Appointments fetched");
}

async function pastByDoctorLocation(req, res) {
  return listAppointments({ doctorId: Number(req.params.doctorId), locationId: Number(req.params.locationId), appointmentDate: { $lt: todayIso() } }, req, res, "Past appointments fetched");
}

async function byDoctorDateLocation(req, res) {
  return listAppointments({ doctorId: Number(req.params.doctorId), locationId: Number(req.params.locationId), appointmentDate: req.query.date || todayIso() }, req, res, "Date appointments fetched");
}

async function cancel(req, res) {
  const appointment = await Appointment.findOneAndUpdate(
    { appointmentId: Number(req.params.appointmentId) },
    {
      appointmentStatus: "CANCELLED",
      cancellationReason: req.body?.cancellationReason || "Cancelled",
      cancelledAt: new Date(),
      cancelledByUserId: req.user?.id,
    },
    { new: true },
  );
  if (!appointment) return error(res, "Appointment not found", 404);
  return success(res, appointment, "Appointment cancelled");
}

module.exports = {
  availableSlots,
  book,
  upcomingByDoctor,
  todayByDoctor,
  pastByDoctor,
  upcomingByPatient,
  pastByPatient,
  byDoctorLocation,
  pastByDoctorLocation,
  byDoctorDateLocation,
  cancel,
};

