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
const User = require("../models/User");
const Secretary = require("../models/Secretary");
const bcrypt = require("bcryptjs");
const { randomBytes } = require("node:crypto");
const { readSheet } = require("read-excel-file/node");
const writeExcelFile = require("write-excel-file/node");

function isAdmin(user) {
  return user?.userType === "ADMIN" || (user?.roles || []).some((role) => role.roleType === "SUPER_ADMIN");
}

async function canManageDoctor(user, doctorId) {
  if (isAdmin(user)) return true;
  const doctor = await Doctor.findOne({ $or: [{ id: Number(doctorId) }, { userId: Number(doctorId) }] }).select("id userId").lean();
  if (!doctor) return false;
  if (user?.userType === "DOCTOR") return Number(doctor.userId) === Number(user.id);
  if (user?.userType === "SECRETARY") {
    return Boolean(await Secretary.exists({ userId: Number(user.id), doctorUserId: Number(doctor.userId), status: "ACTIVE" }));
  }
  return false;
}

async function listDoctors(req, res) {
  const { page, limit, skip } = pagination(req);
  const filter = {
    ...textSearch(req.query.search || req.query.keyword, ["firstName", "lastName", "email", "professionalInfoResponse.designation"]),
    verified: true,
  };
  const [items, total] = await Promise.all([
    Doctor.find(filter).select("-invitationToken -invitationExpiresAt -importedByUserId -__v").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Doctor.countDocuments(filter),
  ]);
  return success(res, paginated(items, page, limit, total), "Doctors fetched");
}

async function getDoctorByUserId(req, res) {
  if (!(await canManageDoctor(req.user, req.params.userId))) return error(res, "You cannot access this doctor record", 403);
  const doctor = await Doctor.findOne({ userId: Number(req.params.userId || req.params.SignleDoctorUserId) }).lean();
  if (!doctor) return error(res, "Doctor not found", 404);
  return success(res, doctor, "Doctor fetched");
}

async function getDoctorById(req, res) {
  const doctor = await Doctor.findOne({ id: Number(req.params.id || req.params.doctorId), verified: true })
    .select("-invitationToken -invitationExpiresAt -importedByUserId -__v")
    .lean();
  if (!doctor) return error(res, "Doctor not found", 404);
  return success(res, doctor, "Doctor fetched");
}

async function updateDoctor(req, res) {
  const userId = Number(req.body.userId);
  if (!isAdmin(req.user) && userId !== Number(req.user.id)) return error(res, "You cannot update another doctor", 403);
  const {
    id: _id,
    userId: _userId,
    password,
    verified,
    status,
    invitationToken: _invitationToken,
    invitationExpiresAt: _invitationExpiresAt,
    importedByUserId: _importedByUserId,
    ...safeBody
  } = req.body;
  if (password && String(password).length < 8) return error(res, "Password must be at least 8 characters", 422);
  const update = {
    ...safeBody,
    ...(isAdmin(req.user) && typeof verified === "boolean" ? { verified } : {}),
    ...(isAdmin(req.user) && status ? { status } : {}),
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
  if (password) {
    await User.updateOne({ id: userId }, { passwordHash: await bcrypt.hash(String(password), 12) });
  }
  return success(res, doctor, "Doctor updated");
}

async function importedBy(req, res) {
  if (!isAdmin(req.user) && Number(req.params.userId) !== Number(req.user.id)) return error(res, "You cannot access another user's imports", 403);
  const doctors = await Doctor.find({ importedByUserId: Number(req.params.userId) }).lean();
  return success(res, { content: doctors }, "Imported doctors fetched");
}

async function downloadImportSample(_req, res) {
  const header = [
    "First Name", "Last Name", "Gender", "Email", "Phone Number", "Designation",
    "Registration Number", "Qualification", "Years of Experience", "Speciality",
  ].map((value) => ({ value, fontWeight: "bold" }));
  const example = [
    "Amina", "Diop", "FEMALE", "amina.diop@example.com", "+221770000000",
    "Consultant", "MED-12345", "MD", 8, "General Medicine",
  ].map((value) => ({ value }));
  const buffer = await writeExcelFile([header, example], { sheet: "Doctors" }).toBuffer();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="doctors_import_sample.xlsx"');
  return res.send(Buffer.from(buffer));
}

async function importDoctors(req, res) {
  if (!req.file?.buffer) return error(res, "An .xlsx file is required", 400);
  if (!req.file.originalname.toLowerCase().endsWith(".xlsx")) {
    return error(res, "Only .xlsx files are supported", 415);
  }

  let rows: Array<Array<unknown>>;
  try {
    rows = await readSheet(req.file.buffer);
  } catch {
    return error(res, "The uploaded spreadsheet is invalid", 422);
  }
  if (rows.length < 2) return error(res, "The spreadsheet contains no doctor rows", 422);
  if (rows.length > 501) return error(res, "A maximum of 500 doctors can be imported at once", 422);

  await ensureDefaultSpecialities();
  const specialities = await Speciality.find({ status: "ACTIVE" }).lean();
  const specialityByName = new Map<string, { id: string; name: string }>(
    specialities.map((item) => [String(item.name).toLowerCase(), { id: item.id, name: item.name }]),
  );
  const imported = [];
  const rejected = [];

  for (let rowNumber = 2; rowNumber <= rows.length; rowNumber += 1) {
    const row = rows[rowNumber - 1];
    const text = (column) => String(row[column - 1] ?? "").trim();
    const firstName = text(1);
    const lastName = text(2);
    const gender = text(3).toUpperCase();
    const email = text(4).toLowerCase();
    if (!firstName || !email) {
      rejected.push({ row: rowNumber, reason: "First Name and Email are required" });
      continue;
    }
    if (await Doctor.exists({ email })) {
      rejected.push({ row: rowNumber, reason: "A doctor with this email already exists" });
      continue;
    }
    const speciality = specialityByName.get(text(10).toLowerCase());
    const doctor = await Doctor.create({
      id: await nextId("doctors"),
      userId: await nextId("users"),
      status: "IMPORTED",
      firstName,
      lastName,
      gender: ["MALE", "FEMALE", "OTHER"].includes(gender) ? gender : "",
      email,
      phoneNumber: text(5),
      qualification: text(8),
      yearsOfExperience: Number(text(9)) || 0,
      importedByUserId: req.user.id,
      professionalInfoResponse: {
        designation: text(6),
        onmsRegistrationNumber: text(7),
        specialities: speciality ? [{ id: speciality.id, name: speciality.name }] : [],
      },
    });
    imported.push(doctor);
  }

  return success(
    res,
    { importedCount: imported.length, rejectedCount: rejected.length, rejected },
    imported.length ? "Doctors imported" : "No doctors were imported",
    imported.length ? 201 : 422,
  );
}

async function invitationInfo(req, res) {
  const invitationToken = String(req.query.invitationToken || "");
  if (!invitationToken) return error(res, "Invitation token is required", 400);
  const doctor = await Doctor.findOne({
    invitationToken,
    status: "INVITED",
    invitationExpiresAt: { $gt: new Date() },
  }).select("firstName lastName email gender phoneNumber").lean();
  if (!doctor) return error(res, "Invitation is invalid or has expired", 404);
  return success(res, doctor, "Invitation info fetched");
}

async function onboard(req, res) {
  const invitationToken = String(req.query.invitationToken || "");
  const { firstName, lastName, gender, email, countryCode, mobileNumber, password } = req.body;
  if (!invitationToken) return error(res, "Invitation token is required", 400);
  if (!firstName || !email || !mobileNumber || !password) {
    return error(res, "First name, email, mobile number, and password are required", 422);
  }
  if (String(password).length < 8) return error(res, "Password must be at least 8 characters", 422);

  const doctor = await Doctor.findOne({
    invitationToken,
    status: "INVITED",
    invitationExpiresAt: { $gt: new Date() },
  });
  if (!doctor) return error(res, "Invitation is invalid or has expired", 404);

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
    id: doctor.userId,
    firstName,
    lastName,
    gender,
    email: normalizedEmail,
    countryCode: normalizedCountryCode,
    mobileNumber: normalizedMobileNumber,
    passwordHash: await bcrypt.hash(String(password), 12),
    userType: "DOCTOR",
    status: "ACTIVE",
    roles: [{ roleName: "DOCTOR", roleType: "DOCTOR" }],
  });

  doctor.set({
    firstName,
    lastName,
    gender,
    email: normalizedEmail,
    phoneNumber: `${normalizedCountryCode}${normalizedMobileNumber}`,
    status: "ACTIVE",
    invitationToken: undefined,
    invitationExpiresAt: undefined,
  });
  await doctor.save();
  return success(res, doctor, "Doctor onboarded");
}

async function invite(req, res) {
  const existing = await Doctor.findOne({ id: Number(req.params.doctorId) }).lean();
  if (!existing) return error(res, "Doctor not found", 404);
  if (!isAdmin(req.user) && Number(existing.importedByUserId) !== Number(req.user.id)) {
    return error(res, "You cannot invite this doctor", 403);
  }
  const token = randomBytes(32).toString("hex");
  const doctor = await Doctor.findOneAndUpdate(
    { id: Number(req.params.doctorId) },
    {
      status: "INVITED",
      invitationToken: token,
      invitationExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    },
    { new: true },
  );
  if (!doctor) return error(res, "Doctor not found", 404);
  return success(res, doctor, "Doctor invitation created");
}

function formatLocationResponse(loc) {
  if (!loc) return null;
  const newFee = loc.newPatientFee != null && loc.newPatientFee > 0 ? loc.newPatientFee : (loc.fees || 0);
  const oldFee = loc.oldPatientFee != null && loc.oldPatientFee > 0 ? loc.oldPatientFee : (loc.fees ? Math.round(loc.fees * 0.8) : 0);
  return {
    ...loc,
    locationId: loc.locationId || loc.id,
    addressLine1: loc.addressLine1 || loc.address || "",
    newPatientFee: newFee,
    oldPatientFee: oldFee,
    fees: loc.fees || newFee,
    feeCurrency: loc.feeCurrency || "XOF",
    supportedAppointmentTypes:
      loc.supportedAppointmentTypes && loc.supportedAppointmentTypes.length > 0
        ? loc.supportedAppointmentTypes
        : [
            { id: 1, name: "Consultation", description: "General in-person consultation" },
            { id: 2, name: "Follow-up", description: "Review and follow-up visit" },
          ],
  };
}

async function locationsByDoctor(req, res) {
  const doctorId = Number(req.params.doctorId);
  const locations = await Location.find({ $or: [{ doctorId }, { doctorUserId: doctorId }] }).sort({ createdAt: -1 }).lean();
  const formatted = locations.map(formatLocationResponse);
  return success(res, formatted, "Doctor locations fetched");
}

async function getLocation(req, res) {
  const location = await Location.findOne({ id: Number(req.params.locationId) }).lean();
  if (!location) return error(res, "Location not found", 404);
  return success(res, formatLocationResponse(location), "Location fetched");
}

async function createLocation(req, res) {
  if (!(await canManageDoctor(req.user, req.body.doctorId || req.body.doctorUserId))) {
    return error(res, "You cannot create a location for this doctor", 403);
  }
  const id = await nextId("locations");
  const newPatientFee = req.body.newPatientFee != null ? Number(req.body.newPatientFee) : (req.body.fees != null ? Number(req.body.fees) : 0);
  const oldPatientFee = req.body.oldPatientFee != null ? Number(req.body.oldPatientFee) : (req.body.fees != null ? Number(req.body.fees) : 0);
  const body = {
    ...req.body,
    id,
    locationId: id,
    address: req.body.address || req.body.addressLine1,
    addressLine1: req.body.addressLine1 || req.body.address,
    newPatientFee,
    oldPatientFee,
    fees: req.body.fees != null ? Number(req.body.fees) : newPatientFee,
    feeCurrency: req.body.feeCurrency || "XOF",
  };
  const location = await Location.create(body);
  return success(res, formatLocationResponse(location.toObject ? location.toObject() : location), "Location created", 201);
}

async function updateLocation(req, res) {
  const id = Number(req.body.id || req.body.locationId);
  const existing = await Location.findOne({ id }).lean();
  if (!existing) return error(res, "Location not found", 404);
  if (!(await canManageDoctor(req.user, existing.doctorId || existing.doctorUserId))) {
    return error(res, "You cannot update this location", 403);
  }
  const update = {
    ...req.body,
    ...(req.body.addressLine1 ? { addressLine1: req.body.addressLine1, address: req.body.addressLine1 } : {}),
    ...(req.body.newPatientFee != null ? { newPatientFee: Number(req.body.newPatientFee) } : {}),
    ...(req.body.oldPatientFee != null ? { oldPatientFee: Number(req.body.oldPatientFee) } : {}),
    ...(req.body.feeCurrency ? { feeCurrency: req.body.feeCurrency } : {}),
  };
  const location = await Location.findOneAndUpdate({ id }, update, { new: true }).lean();
  if (!location) return error(res, "Location not found", 404);
  return success(res, formatLocationResponse(location), "Location updated");
}

async function deleteLocation(req, res) {
  const existing = await Location.findOne({ id: Number(req.params.locationId) }).lean();
  if (!existing) return error(res, "Location not found", 404);
  if (!(await canManageDoctor(req.user, existing.doctorId || existing.doctorUserId))) {
    return error(res, "You cannot delete this location", 403);
  }
  await Location.deleteOne({ id: existing.id });
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
    if (!(await canManageDoctor(req.user, row.doctorId || req.body.doctorId))) {
      return error(res, "You cannot manage availability for this doctor", 403);
    }
    const timeSlot = String(row.timeSlot || "");
    const slotDuration = Number(row.slotDuration) || ({
      MIN_10: 10, MIN_15: 15, MIN_30: 30, HOUR_1: 60, MIN_90: 90, HOUR_2: 120,
    }[timeSlot] || 30);
    created.push(await Availability.create({
      ...row,
      doctorId: Number(row.doctorId || req.body.doctorId),
      doctorLocationId: Number(row.doctorLocationId || row.locationId),
      slotDuration,
      status: row.status || (row.availabilityStatus === "UNAVAILABLE" ? "INACTIVE" : "ACTIVE"),
      id: await nextId("availability"),
    }));
  }
  return success(res, created.length === 1 ? created[0] : created, "Availability created", 201);
}

async function updateAvailability(req, res) {
  const id = Number(req.body.id || req.body.availabilityIds?.[0]);
  const existing = await Availability.findOne({ id }).lean();
  if (!existing) return error(res, "Availability not found", 404);
  if (!(await canManageDoctor(req.user, existing.doctorId))) return error(res, "You cannot update this availability", 403);
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
  const existing = await Availability.findOne({ id: Number(req.params.id) }).lean();
  if (!existing) return error(res, "Availability not found", 404);
  if (!(await canManageDoctor(req.user, existing.doctorId))) return error(res, "You cannot delete this availability", 403);
  await Availability.deleteOne({ id: existing.id });
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
  if (!(await canManageDoctor(req.user, req.body.doctorId))) return error(res, "You cannot manage unavailability for this doctor", 403);
  const item = await UnavailableDate.create({ ...req.body, id: await nextId("unavailableDates") });
  return success(res, item, "Unavailable date created", 201);
}

async function updateUnavailability(req, res) {
  const existing = await UnavailableDate.findOne({ id: Number(req.body.id) }).lean();
  if (!existing) return error(res, "Unavailable date not found", 404);
  if (!(await canManageDoctor(req.user, existing.doctorId))) return error(res, "You cannot update this unavailable date", 403);
  const item = await UnavailableDate.findOneAndUpdate({ id: existing.id }, req.body, { new: true });
  if (!item) return error(res, "Unavailable date not found", 404);
  return success(res, item, "Unavailable date updated");
}

async function deleteUnavailability(req, res) {
  const existing = await UnavailableDate.findOne({ id: Number(req.params.id) }).lean();
  if (!existing) return error(res, "Unavailable date not found", 404);
  if (!(await canManageDoctor(req.user, existing.doctorId))) return error(res, "You cannot delete this unavailable date", 403);
  await UnavailableDate.deleteOne({ id: existing.id });
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
  downloadImportSample,
  importDoctors,
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
