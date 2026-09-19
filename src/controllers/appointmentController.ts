const Appointment = require("../models/Appointment");
const AppointmentSlotReservation = require("../models/AppointmentSlotReservation");
const Availability = require("../models/Availability");
const Location = require("../models/Location");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const Secretary = require("../models/Secretary");
const { success, error, paginated } = require("../utils/apiResponse");
const { pagination, todayIso } = require("../utils/query");
const { nextId } = require("../utils/ids");

function isAdmin(user) {
  return user?.userType === "ADMIN" || (user?.roles || []).some((role) => role.roleType === "SUPER_ADMIN");
}

function slotReservationId({ doctorId, locationId, appointmentDate, startTime }) {
  return [doctorId, locationId, appointmentDate, startTime].join(":");
}

async function canManageDoctor(user, doctorId) {
  if (isAdmin(user)) return true;
  const doctor = await Doctor.findOne({ id: Number(doctorId) }).select("userId").lean();
  if (!doctor) return false;
  if (user?.userType === "DOCTOR") return Number(doctor.userId) === Number(user.id);
  if (user?.userType === "SECRETARY") {
    return Boolean(await Secretary.exists({ userId: Number(user.id), doctorUserId: Number(doctor.userId), status: "ACTIVE" }));
  }
  return false;
}

async function availableSlots(req, res) {
  const doctorId = Number(req.params.doctorId);
  const locationId = Number(req.params.doctorLocationId);
  const date = req.query.date || req.query.appointmentDate || req.query.requestedDate;
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
  const location = await Location.findOne({ $or: [{ id: Number(slot.locationId) }, { locationId: Number(slot.locationId) }] }).lean();
  if (!doctor) return error(res, "Doctor not found", 404);
  if (req.user.userType === "PATIENT") {
    req.body.patientUserId = req.user.id;
    req.body.bookedByUserId = req.user.id;
    req.body.bookingSource = "PATIENT";
  } else if (!isAdmin(req.user) && !(await canManageDoctor(req.user, doctor.id))) {
    return error(res, "You cannot book appointments for this doctor", 403);
  }
  const patient = req.body.patientUserId ? await Patient.findOne({ userId: Number(req.body.patientUserId) }).lean() : null;
  const appointmentDate = String(req.body.appointmentDate || "");
  if (!appointmentDate || !slot.locationId || !slot.startTime || !slot.endTime) {
    return error(res, "Appointment date, location, start time, and end time are required", 422);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) || Number.isNaN(Date.parse(`${appointmentDate}T12:00:00Z`))) {
    return error(res, "Appointment date must use YYYY-MM-DD format", 422);
  }
  if (appointmentDate < todayIso()) return error(res, "Appointments cannot be booked in the past", 422);
  const bookingDay = new Date(`${appointmentDate}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toUpperCase();
  const available = await Availability.exists({
    doctorId: doctor.id,
    doctorLocationId: Number(slot.locationId),
    status: "ACTIVE",
    dayOfWeek: { $in: [bookingDay, bookingDay.toLowerCase(), bookingDay[0] + bookingDay.slice(1).toLowerCase()] },
    startTime: slot.startTime,
    endTime: slot.endTime,
  });
  if (!available) return error(res, "The selected appointment slot is not available", 409);
  const alreadyBooked = await Appointment.exists({
    doctorId: doctor.id,
    locationId: Number(slot.locationId),
    appointmentDate,
    startTime: slot.startTime,
    appointmentStatus: { $ne: "CANCELLED" },
  });
  if (alreadyBooked) return error(res, "The selected appointment slot has already been booked", 409);

  const reservationId = slotReservationId({
    doctorId: doctor.id,
    locationId: Number(slot.locationId),
    appointmentDate,
    startTime: slot.startTime,
  });
  const holdExpiry = new Date(Date.now() + 2 * 60 * 1000);
  try {
    await AppointmentSlotReservation.create({
      _id: reservationId,
      doctorId: doctor.id,
      locationId: Number(slot.locationId),
      appointmentDate,
      startTime: slot.startTime,
      patientUserId: req.body.patientUserId,
      expiresAt: holdExpiry,
    });
  } catch (reservationError) {
    if (reservationError?.code === 11000) {
      return error(res, "The selected appointment slot has already been booked", 409);
    }
    throw reservationError;
  }

  const patientType = req.body.patientType === "returning" || req.body.isNewPatient === false ? "returning" : "new";
  // Fees are authoritative server-side values. Never trust a client-supplied
  // amount for a billable appointment.
  const fees = location
    ? patientType === "returning"
      ? (location.oldPatientFee != null && location.oldPatientFee > 0 ? location.oldPatientFee : (location.fees ? Math.round(location.fees * 0.8) : 0))
      : (location.newPatientFee != null && location.newPatientFee > 0 ? location.newPatientFee : (location.fees || 0))
    : 0;

  let appointment;
  try {
    appointment = await Appointment.create({
      appointmentId: await nextId("appointments"),
      doctorId: doctor.id,
      doctorUserId: doctor.userId,
      patientUserId: req.body.patientUserId,
      patientType,
      appointmentTypeId: req.body.appointmentTypeId || 1,
      doctorName: `${doctor.firstName || ""} ${doctor.lastName || ""}`.trim(),
      designation: doctor.professionalInfoResponse?.designation,
      patientName: req.body.patientName || `${patient?.firstName || ""} ${patient?.lastName || ""}`.trim(),
      patientGender: req.body.patientGender || patient?.gender,
      patientAge: req.body.patientAge,
      patientPhone: req.body.patientPhone || patient?.mobileNumber,
      patientEmail: req.body.patientEmail || patient?.email,
      appointmentDate,
      dayOfWeek: req.body.dayOfWeek,
      locationId: slot.locationId,
      locationName: location?.locationName,
      startTime: slot.startTime,
      endTime: slot.endTime,
      slotDuration: slot.slotDuration,
      fees: Number(fees) || 0,
      notes: req.body.notes,
      bookingSource: req.body.bookingSource || "PATIENT",
      bookedByUserId: req.body.bookedByUserId || req.body.patientUserId,
    });
    const appointmentExpiry = new Date(`${appointmentDate}T23:59:59.999Z`);
    appointmentExpiry.setUTCDate(appointmentExpiry.getUTCDate() + 1);
    await AppointmentSlotReservation.updateOne(
      { _id: reservationId },
      { $set: { appointmentId: appointment.appointmentId, expiresAt: appointmentExpiry } },
    );
  } catch (appointmentError) {
    await AppointmentSlotReservation.deleteOne({ _id: reservationId });
    throw appointmentError;
  }
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
  if (!(await canManageDoctor(req.user, req.params.doctorId))) return error(res, "You do not have access to these appointments", 403);
  return listAppointments({ doctorId: Number(req.params.doctorId), appointmentDate: { $gte: todayIso() }, appointmentStatus: { $ne: "CANCELLED" } }, req, res, "Upcoming appointments fetched");
}

async function todayByDoctor(req, res) {
  if (!(await canManageDoctor(req.user, req.params.doctorId))) return error(res, "You do not have access to these appointments", 403);
  return listAppointments({ doctorId: Number(req.params.doctorId), appointmentDate: todayIso(), appointmentStatus: { $ne: "CANCELLED" } }, req, res, "Today's appointments fetched");
}

async function pastByDoctor(req, res) {
  if (!(await canManageDoctor(req.user, req.params.doctorId))) return error(res, "You do not have access to these appointments", 403);
  return listAppointments({ doctorId: Number(req.params.doctorId), appointmentDate: { $lt: todayIso() } }, req, res, "Past appointments fetched");
}

async function upcomingByPatient(req, res) {
  if (!isAdmin(req.user) && Number(req.params.patientUserId) !== Number(req.user.id)) return error(res, "You do not have access to these appointments", 403);
  return listAppointments({ patientUserId: Number(req.params.patientUserId), appointmentDate: { $gte: todayIso() }, appointmentStatus: { $ne: "CANCELLED" } }, req, res, "Upcoming appointments fetched");
}

async function pastByPatient(req, res) {
  if (!isAdmin(req.user) && Number(req.params.patientUserId) !== Number(req.user.id)) return error(res, "You do not have access to these appointments", 403);
  return listAppointments({ patientUserId: Number(req.params.patientUserId), appointmentDate: { $lt: todayIso() } }, req, res, "Past appointments fetched");
}

async function byDoctorLocation(req, res) {
  if (!(await canManageDoctor(req.user, req.params.doctorId))) return error(res, "You do not have access to these appointments", 403);
  return listAppointments({ doctorId: Number(req.params.doctorId), locationId: Number(req.params.locationId), appointmentDate: { $gte: todayIso() } }, req, res, "Appointments fetched");
}

async function pastByDoctorLocation(req, res) {
  if (!(await canManageDoctor(req.user, req.params.doctorId))) return error(res, "You do not have access to these appointments", 403);
  return listAppointments({ doctorId: Number(req.params.doctorId), locationId: Number(req.params.locationId), appointmentDate: { $lt: todayIso() } }, req, res, "Past appointments fetched");
}

async function byDoctorDateLocation(req, res) {
  if (!(await canManageDoctor(req.user, req.params.doctorId))) return error(res, "You do not have access to these appointments", 403);
  return listAppointments({ doctorId: Number(req.params.doctorId), locationId: Number(req.params.locationId), appointmentDate: req.query.date || todayIso() }, req, res, "Date appointments fetched");
}

async function cancel(req, res) {
  const existing = await Appointment.findOne({ appointmentId: Number(req.params.appointmentId) }).lean();
  if (!existing) return error(res, "Appointment not found", 404);
  const permitted = isAdmin(req.user)
    || Number(existing.patientUserId) === Number(req.user.id)
    || await canManageDoctor(req.user, existing.doctorId);
  if (!permitted) return error(res, "You cannot cancel this appointment", 403);
  const appointment = await Appointment.findOneAndUpdate(
    { appointmentId: existing.appointmentId },
    {
      appointmentStatus: "CANCELLED",
      cancellationReason: req.body?.cancellationReason || "Cancelled",
      cancelledAt: new Date(),
      cancelledByUserId: req.user?.id,
    },
    { new: true },
  );
  if (!appointment) return error(res, "Appointment not found", 404);
  await AppointmentSlotReservation.deleteOne({
    _id: slotReservationId({
      doctorId: existing.doctorId,
      locationId: existing.locationId,
      appointmentDate: existing.appointmentDate,
      startTime: existing.startTime,
    }),
    appointmentId: existing.appointmentId,
  });
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
