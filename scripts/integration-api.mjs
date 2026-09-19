import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dns from "node:dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);
dns.setDefaultResultOrder("ipv4first");

const baseUrl = (process.argv[2] || "http://localhost:5001").replace(/\/$/, "");
if (!baseUrl.includes("localhost") && !process.argv.includes("--allow-remote")) {
  throw new Error("Stateful integration tests are restricted to localhost by default");
}

const tag = "release-smoke-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
const password = "ReleaseSmoke!2468";
const changedPassword = "ReleaseSmoke!9753";
const tracked = {};
const passed = [];
const remember = (collection, id) => {
  if (id == null) return id;
  tracked[collection] ||= new Set();
  tracked[collection].add(Number(id));
  return id;
};
const phone = (suffix) => "77" + String(Date.now()).slice(-6) + suffix;

async function api(name, method, path, options = {}) {
  const headers = {};
  if (options.token) headers.Authorization = "Bearer " + options.token;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(baseUrl + path, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(20000),
  });
  const data = (response.headers.get("content-type") || "").includes("json")
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());
  const expected = options.expected || [200, 201];
  if (!expected.includes(response.status)) {
    throw new Error(name + ": expected " + expected.join("/") + ", got " + response.status + ": " + JSON.stringify(data));
  }
  passed.push(name);
  return data;
}

async function rawApi(method, path, options = {}) {
  const headers = {};
  if (options.token) headers.Authorization = "Bearer " + options.token;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(baseUrl + path, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(20000),
  });
  const data = (response.headers.get("content-type") || "").includes("json")
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());
  return { status: response.status, data };
}

function token(response) {
  if (!response?.payload?.accessToken) throw new Error("Login did not return an access token");
  return response.payload.accessToken;
}

async function cleanup(db) {
  const keys = {
    secretarylocations: "id",
    hospitaldoctors: "id",
    chatthreads: "id",
    appointments: "appointmentId",
    unavailabledates: "id",
    availabilities: "id",
    locations: "id",
    beneficiaries: "id",
    secretaries: "id",
    doctors: "id",
    patients: "id",
    hospitals: "id",
    roles: "id",
    specialities: "id",
    users: "id",
  };
  for (const [collection, ids] of Object.entries(tracked)) {
    if (ids.size && keys[collection]) {
      await db.collection(collection).deleteMany({ [keys[collection]]: { $in: [...ids] } });
    }
  }
  if (tracked.users?.size) {
    await db.collection("appointmentslotreservations").deleteMany({
      patientUserId: { $in: [...tracked.users] },
    });
  }
  await db.collection("users").deleteMany({ email: { $regex: "^" + tag } });
  await db.collection("doctors").deleteMany({ email: { $regex: "^" + tag } });
}

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;

try {
  const adminId = 900000000 + Math.floor(Math.random() * 90000000);
  const adminPhone = phone("01");
  await db.collection("users").insertOne({
    id: adminId,
    firstName: "Release",
    lastName: "Admin",
    email: tag + "-admin@example.com",
    countryCode: "+221",
    mobileNumber: adminPhone,
    passwordHash: await bcrypt.hash(password, 12),
    userType: "ADMIN",
    status: "ACTIVE",
    roles: [{ roleName: "SUPER_ADMIN", roleType: "SUPER_ADMIN" }],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  remember("users", adminId);

  const adminToken = token(await api("admin sign-in", "POST", "/api/admin/auth/sign-in", {
    body: { countryCode: "+221", phoneNumber: adminPhone, password },
  }));
  await api("admin dashboard", "GET", "/api/admin/stats/dashboard", { token: adminToken });
  await api("admin user list", "GET", "/api/admin/users/paginated", { token: adminToken });
  await api("admin role types", "GET", "/api/admin/roles/role-type/all", { token: adminToken });
  await api("admin privileges", "GET", "/api/admin/privileges", { token: adminToken });

  const speciality = await api("speciality create", "POST", "/api/admin/speciality/create", {
    token: adminToken,
    body: { name: tag + " Medicine", status: "ACTIVE" },
  });
  const specialityId = remember("specialities", speciality.payload.id);
  await api("speciality get", "GET", "/api/admin/speciality/id/" + specialityId);
  await api("speciality update", "PUT", "/api/admin/speciality/update/id/" + specialityId, {
    token: adminToken,
    body: { description: "Updated integration speciality" },
  });

  const role = await api("role create", "POST", "/api/admin/roles/create", {
    token: adminToken,
    body: { roleName: tag + " Role", roleType: "ADMIN", privileges: [] },
  });
  const roleId = remember("roles", role.payload.id);
  await api("roles list", "GET", "/api/admin/roles/paginated", { token: adminToken });
  await api("role get", "GET", "/api/admin/roles/id/" + roleId, { token: adminToken });
  await api("role update", "PUT", "/api/admin/roles/update", {
    token: adminToken,
    body: { id: roleId, description: "Updated integration role" },
  });

  await api("privileged registration blocked", "POST", "/api/auth/sign-up", {
    body: {
      firstName: "Blocked",
      email: tag + "-blocked@example.com",
      countryCode: "+221",
      mobileNumber: phone("02"),
      password,
      userType: "ADMIN",
    },
    expected: [403],
  });

  const patientPhone = phone("03");
  const patientEmail = tag + "-patient@example.com";
  const patientSignup = await api("patient sign-up", "POST", "/api/auth/sign-up", {
    body: {
      firstName: "Release",
      lastName: "Patient",
      gender: "OTHER",
      email: patientEmail,
      countryCode: "+221",
      mobileNumber: patientPhone,
      password,
      userType: "PATIENT",
      dateOfBirth: "1990-01-01",
    },
  });
  const patientUserId = remember("users", patientSignup.payload.userId);
  const patientDocument = await db.collection("patients").findOne({ userId: patientUserId });
  remember("patients", patientDocument.id);
  let patientToken = token(await api("patient sign-in", "POST", "/api/auth/sign-in", {
    body: { countryCode: "+221", phoneNumber: patientPhone, password },
  }));
  await api("current user", "GET", "/api/users/me", { token: patientToken });
  await api("patient get", "GET", "/api/patients/id/" + patientUserId, { token: patientToken });
  await api("patient update", "PATCH", "/api/patients/update", {
    token: patientToken,
    body: { userId: patientUserId, firstName: "Release Updated" },
  });

  const beneficiary = await api("beneficiary add", "POST", "/api/patients/beneficiary/add", {
    token: patientToken,
    body: { firstName: "Dependent", relation: "CHILD", age: 8 },
  });
  const beneficiaryId = remember("beneficiaries", beneficiary.payload.id);
  await api("beneficiary list", "GET", "/api/patients/beneficiary/paginated", { token: patientToken });
  await api("beneficiary delete", "DELETE", "/api/patients/beneficiary/delete/" + beneficiaryId, { token: patientToken });
  tracked.beneficiaries.delete(beneficiaryId);

  const forgot = await api("forgot password", "POST", "/api/auth/forgot-password", { body: { email: patientEmail } });
  if (!forgot.payload?.otp) throw new Error("Development password reset did not return an OTP");
  const otp = await api("verify OTP", "POST", "/api/auth/verify-otp", {
    body: { email: patientEmail, otp: forgot.payload.otp },
  });
  await api("reset password", "POST", "/api/auth/reset-password", {
    body: { email: patientEmail, resetToken: otp.payload.resetToken, newPassword: changedPassword },
  });
  await api("reset token cannot be reused", "POST", "/api/auth/reset-password", {
    body: { email: patientEmail, resetToken: otp.payload.resetToken, newPassword: password },
    expected: [401],
  });
  patientToken = token(await api("sign-in after reset", "POST", "/api/auth/sign-in", {
    body: { countryCode: "+221", phoneNumber: patientPhone, password: changedPassword },
  }));
  await api("wrong current password rejected", "POST", "/api/auth/change-password", {
    token: patientToken,
    body: { currentPassword: "DefinitelyWrong!1", newPassword: password },
    expected: [401],
  });
  patientToken = token(await api("authenticated password change", "POST", "/api/auth/change-password", {
    token: patientToken,
    body: { currentPassword: changedPassword, newPassword: password },
  }));

  const doctorPhone = phone("04");
  const doctorSignup = await api("doctor sign-up", "POST", "/api/auth/sign-up", {
    body: {
      firstName: "Release",
      lastName: "Doctor",
      gender: "OTHER",
      email: tag + "-doctor@example.com",
      countryCode: "+221",
      mobileNumber: doctorPhone,
      password,
      userType: "DOCTOR",
      professionalInfoRequest: {
        designation: "Physician",
        onmsRegistrationNumber: tag,
        specialityId: [specialityId],
      },
    },
  });
  const doctorUserId = remember("users", doctorSignup.payload.userId);
  const doctorDocument = await db.collection("doctors").findOne({ userId: doctorUserId });
  const doctorId = remember("doctors", doctorDocument.id);
  const doctorToken = token(await api("doctor sign-in", "POST", "/api/auth/sign-in", {
    body: { countryCode: "+221", phoneNumber: doctorPhone, password },
  }));
  await api("doctor own record", "GET", "/api/doctors/id/" + doctorUserId, { token: doctorToken });
  await api("doctor update", "PATCH", "/api/doctors/update", {
    token: doctorToken,
    body: { userId: doctorUserId, qualification: "MD" },
  });
  await api("patient doctor update blocked", "PATCH", "/api/doctors/update", {
    token: patientToken,
    body: { userId: doctorUserId, qualification: "Tampered" },
    expected: [403],
  });
  await api("admin doctor verification", "PATCH", "/api/doctors/update", {
    token: adminToken,
    body: { userId: doctorUserId, verified: true },
  });
  await api("doctor public profile", "GET", "/api/doctors/" + doctorId);
  await api("doctor public list", "GET", "/api/doctors/paginated");

  const location = await api("doctor location create", "POST", "/api/doctors/location/create", {
    token: doctorToken,
    body: {
      doctorId,
      doctorUserId,
      locationName: tag + " Clinic",
      addressLine1: "1 Integration Street",
      city: "Dakar",
      newPatientFee: 1000,
      oldPatientFee: 800,
    },
  });
  const locationId = remember("locations", location.payload.id);
  await api("doctor location list", "GET", "/api/doctors/location/all/" + doctorId);
  await api("doctor location get", "GET", "/api/doctors/location/" + locationId);
  await api("doctor location update", "PUT", "/api/doctors/location/update", {
    token: doctorToken,
    body: { id: locationId, locationName: tag + " Clinic Updated" },
  });

  const appointmentDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const day = new Date(appointmentDate + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toUpperCase();
  const availability = await api("availability create", "POST", "/api/doctors/availability/create", {
    token: doctorToken,
    body: { doctorId, doctorLocationId: locationId, dayOfWeek: day, startTime: "09:00", endTime: "12:00", slotDuration: 30 },
  });
  const availabilityId = remember("availabilities", availability.payload.id);
  await api("availability list", "GET", "/api/doctors/availability/all/doctorId/" + doctorId + "/location/" + locationId);
  await api("availability update", "PUT", "/api/doctors/availability/update", {
    token: doctorToken,
    body: { id: availabilityId, startTime: "09:30" },
  });
  await api("available slots", "GET", "/api/appointments/available-slots/doctor/" + doctorId + "/doctor-location/" + locationId + "?date=" + appointmentDate);
  await api("appointment types", "GET", "/api/appointments/type/all");

  const unavailable = await api("unavailability create", "POST", "/api/doctors/unavailability/set", {
    token: doctorToken,
    body: { doctorId, unavailableDate: "2099-12-31", reason: "Integration test" },
  });
  const unavailableId = remember("unavailabledates", unavailable.payload.id);
  await api("unavailability list", "GET", "/api/doctors/unavailability/all/doctorId/" + doctorId);
  await api("unavailability update", "PUT", "/api/doctors/unavailability/update", {
    token: doctorToken,
    body: { id: unavailableId, reason: "Updated integration test" },
  });

  const bookingBody = {
    doctorId,
    patientUserId,
    appointmentDate,
    appointmentSlotDto: { locationId, startTime: "09:30", endTime: "12:00", slotDuration: 30 },
  };
  const concurrentBookings = await Promise.all([
    rawApi("POST", "/api/appointments/book-appointment", { token: patientToken, body: bookingBody }),
    rawApi("POST", "/api/appointments/book-appointment", { token: patientToken, body: bookingBody }),
  ]);
  const bookingStatuses = concurrentBookings.map((result) => result.status).sort();
  if (bookingStatuses.join(",") !== "201,409") {
    throw new Error("concurrent double booking prevention: expected 201,409, got " + bookingStatuses.join(","));
  }
  passed.push("concurrent double booking prevention");
  const reservationTtlIndex = (await db.collection("appointmentslotreservations").indexes())
    .find((index) => index.key?.expiresAt === 1 && index.expireAfterSeconds === 0);
  if (!reservationTtlIndex) throw new Error("appointment reservation TTL index is missing");
  passed.push("appointment reservation TTL index");
  const appointment = concurrentBookings.find((result) => result.status === 201)?.data;
  const appointmentId = remember("appointments", appointment.payload.appointmentId);
  await api("patient appointments", "GET", "/api/appointments/all/upcoming/patientUserId/" + patientUserId, { token: patientToken });
  await api("doctor appointments", "GET", "/api/appointments/all/upcoming/doctorId/" + doctorId, { token: doctorToken });
  await api("doctor dated appointments", "GET", "/api/appointments/all/doctorId/" + doctorId + "/date/doctorLocationId/" + locationId + "?date=" + appointmentDate, { token: doctorToken });
  await api("appointment cancel", "PATCH", "/api/appointments/cancel-appointment/" + appointmentId, {
    token: patientToken,
    body: { cancellationReason: "Integration test" },
  });

  const thread = await api("chat thread create", "POST", "/api/chat/threads", {
    token: patientToken,
    body: { doctorUserId, patientUserId, subject: tag },
  });
  const threadId = remember("chatthreads", thread.payload.id);
  await api("chat thread get", "GET", "/api/chat/threads/id/" + threadId, { token: doctorToken });
  await api("patient chats", "GET", "/api/chat/threads/patient/" + patientUserId, { token: patientToken });
  await api("doctor chats", "GET", "/api/chat/threads/doctor/" + doctorUserId, { token: doctorToken });
  await api("chat message", "POST", "/api/chat/threads/" + threadId + "/messages", {
    token: patientToken,
    body: { body: "Integration test" },
  });
  await api("chat messages", "GET", "/api/chat/threads/" + threadId + "/messages", { token: doctorToken });

  const hospitalPhone = phone("05");
  const hospitalSignup = await api("hospital sign-up", "POST", "/api/auth/hospital/sign-up", {
    body: {
      hospitalName: tag + " Hospital",
      email: tag + "-hospital@example.com",
      countryCode: "+221",
      mobileNumber: hospitalPhone,
      password,
    },
  });
  const hospitalUserId = remember("users", hospitalSignup.payload.userId);
  const hospitalDocument = await db.collection("hospitals").findOne({ userId: hospitalUserId });
  const hospitalId = remember("hospitals", hospitalDocument.id);
  const hospitalToken = token(await api("hospital sign-in", "POST", "/api/auth/sign-in", {
    body: { countryCode: "+221", phoneNumber: hospitalPhone, password },
  }));
  await api("hospital own record", "GET", "/api/hospitals/id/" + hospitalUserId, { token: hospitalToken });
  await api("hospital public record", "GET", "/api/hospitals/public/" + hospitalId);
  await api("hospital update", "PUT", "/api/hospitals/update/" + hospitalId, {
    token: hospitalToken,
    body: { hospitalName: tag + " Hospital Updated" },
  });

  const hospitalLocation = await api("hospital location create", "POST", "/api/hospitals/locations/create", {
    token: hospitalToken,
    body: { hospitalId, hospitalUserId, locationName: tag + " Hospital Location", city: "Dakar" },
  });
  const hospitalLocationId = remember("locations", hospitalLocation.payload.id);
  await api("hospital locations", "GET", "/api/hospitals/locations/hospital/" + hospitalId, { token: hospitalToken });
  await api("hospital location update", "PUT", "/api/hospitals/locations/update", {
    token: hospitalToken,
    body: { id: hospitalLocationId, locationName: tag + " Hospital Location Updated" },
  });

  const assignment = await api("hospital doctor assign", "POST", "/api/hospital-doctors/assign", {
    token: hospitalToken,
    body: { hospitalId, hospitalUserId, doctorId, doctorUserId },
  });
  const assignmentId = remember("hospitaldoctors", assignment.payload.id);
  await api("hospital doctors", "GET", "/api/hospital-doctors/hospital/" + hospitalId);
  await api("hospital doctor unassign", "DELETE", "/api/hospital-doctors/unassign/" + assignmentId, { token: hospitalToken });
  tracked.hospitaldoctors.delete(assignmentId);

  const secretary = await api("secretary create", "POST", "/api/secretaries/create", {
    token: doctorToken,
    body: {
      doctorUserId,
      doctorId,
      firstName: "Release",
      lastName: "Secretary",
      email: tag + "-secretary@example.com",
    },
  });
  const secretaryId = remember("secretaries", secretary.payload.id);
  const secretaryUserId = secretary.payload.userId;
  const invitation = await api("secretary invite", "POST", "/api/secretaries/invite/" + secretaryUserId, { token: doctorToken });
  await api("secretary invitation info", "GET", "/api/secretaries/invitation/info?invitationToken=" + invitation.payload.invitationToken);
  const secretaryPhone = phone("06");
  await api("secretary onboard", "POST", "/api/secretaries/onboard?invitationToken=" + invitation.payload.invitationToken, {
    body: {
      firstName: "Release",
      lastName: "Secretary",
      gender: "OTHER",
      email: tag + "-secretary@example.com",
      countryCode: "+221",
      mobileNumber: secretaryPhone,
      password,
    },
  });
  remember("users", secretaryUserId);
  const secretaryToken = token(await api("secretary sign-in", "POST", "/api/auth/sign-in", {
    body: { countryCode: "+221", phoneNumber: secretaryPhone, password },
  }));
  await api("secretary own record", "GET", "/api/secretaries/userId/" + secretaryUserId, { token: secretaryToken });
  await api("doctor secretaries", "GET", "/api/secretaries/doctorUserId/" + doctorUserId, { token: doctorToken });
  const secretaryLocation = await api("secretary location assign", "POST", "/api/secretary-locations/assign", {
    token: doctorToken,
    body: { userId: secretaryUserId, locationId, doctorId },
  });
  remember("secretarylocations", secretaryLocation.payload.id);
  await api("secretary locations", "GET", "/api/secretary-locations/secretary/userId/" + secretaryUserId, { token: secretaryToken });
  await api("secretary location remove", "POST", "/api/secretary-locations/remove", {
    token: doctorToken,
    body: { userId: secretaryUserId, locationId },
  });
  await api("secretary delete", "DELETE", "/api/secretaries/delete/userId/" + secretaryUserId, { token: doctorToken });
  tracked.secretaries.delete(secretaryId);

  await api("global search GET", "GET", "/api/global-search/search?q=" + encodeURIComponent(tag));
  await api("global search POST", "POST", "/api/global-search/search", { body: { search: tag } });
  await api("doctor cities", "GET", "/api/global-search/cities/doctors");
  await api("hospital cities", "GET", "/api/global-search/cities/hospitals");
  await api("sign-out", "GET", "/api/auth/sign-out", { token: patientToken });

  await api("unavailability delete", "DELETE", "/api/doctors/unavailability/" + unavailableId, { token: doctorToken });
  tracked.unavailabledates.delete(unavailableId);
  await api("availability delete", "DELETE", "/api/doctors/availability/" + availabilityId, { token: doctorToken });
  tracked.availabilities.delete(availabilityId);
  await api("hospital location delete", "DELETE", "/api/hospitals/locations/delete/" + hospitalLocationId, { token: hospitalToken });
  tracked.locations.delete(hospitalLocationId);
  await api("doctor location delete", "DELETE", "/api/doctors/location/delete/locationId/" + locationId + "/doctorId/" + doctorId, { token: doctorToken });
  tracked.locations.delete(locationId);
  await api("role delete", "DELETE", "/api/admin/roles/id/" + roleId + "/delete", { token: adminToken });
  tracked.roles.delete(roleId);
  await api("speciality delete", "DELETE", "/api/admin/speciality/delete/id/" + specialityId, { token: adminToken });
  tracked.specialities.delete(specialityId);

  console.log("Stateful API integration: " + passed.length + "/" + passed.length + " passed against " + baseUrl);
} finally {
  await cleanup(db);
  await mongoose.disconnect();
}
