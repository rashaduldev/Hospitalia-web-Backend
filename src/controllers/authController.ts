const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const env = require("../config/env");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const Hospital = require("../models/Hospital");
const { nextId } = require("../utils/ids");
const { success, error } = require("../utils/apiResponse");

function normalizePhone(countryCode = "+880", phoneNumber = "") {
  return {
    countryCode,
    mobileNumber: String(phoneNumber).replace(/^\+?880/, "").replace(/^0/, ""),
  };
}

function tokens(user) {
  const payload = { sub: user.id, userType: user.userType, roles: user.roles };
  return {
    accessToken: jwt.sign(payload, env.jwtAccessSecret, { expiresIn: env.jwtAccessExpiresIn }),
    refreshToken: jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: env.jwtRefreshExpiresIn }),
  };
}

async function createUser(body, fallbackType) {
  const userId = await nextId("users");
  const countryCode = body.countryCode || "+880";
  const mobileNumber = body.mobileNumber || body.phoneNumber;
  const userType = body.userType || fallbackType || "PATIENT";
  const passwordHash = await bcrypt.hash(body.password || "Password123", 10);
  const user = await User.create({
    id: userId,
    firstName: body.firstName || body.hospitalName || "User",
    lastName: body.lastName || "",
    gender: body.gender || "",
    email: body.email,
    countryCode,
    mobileNumber,
    passwordHash,
    userType,
    roles: [{ roleName: userType, roleType: userType }],
  });

  if (userType === "DOCTOR") {
    const specialityIds = body.professionalInfoRequest?.specialityId || [];
    await Doctor.create({
      id: await nextId("doctors"),
      userId,
      firstName: user.firstName,
      lastName: user.lastName,
      gender: user.gender,
      email: user.email,
      phoneNumber: `${countryCode}${mobileNumber}`,
      verified: true,
      professionalInfoResponse: {
        designation: body.professionalInfoRequest?.designation || "Doctor",
        onmsRegistrationNumber: body.professionalInfoRequest?.onmsRegistrationNumber || "",
        professionalStatement: body.professionalInfoRequest?.professionalStatement || "",
        workPhoneNumber: body.professionalInfoRequest?.workPhoneNumber || `${countryCode}${mobileNumber}`,
        specialities: specialityIds.map((id) => ({ id, name: `Speciality ${id}` })),
      },
    });
  }

  if (userType === "PATIENT") {
    await Patient.create({
      id: await nextId("patients"),
      userId,
      firstName: user.firstName,
      lastName: user.lastName,
      gender: user.gender,
      email: user.email,
      countryCode,
      mobileNumber,
      dateOfBirth: body.dateOfBirth,
    });
  }

  if (userType === "HOSPITAL") {
    await Hospital.create({
      id: await nextId("hospitals"),
      userId,
      hospitalName: body.hospitalName || user.firstName,
      email: user.email,
      countryCode,
      mobileNumber,
      workPhoneNumber: `${countryCode}${mobileNumber}`,
      professionalInfoResponse: {
        departments: [],
        specialities: [],
      },
    });
  }

  return user;
}

async function signUp(req, res) {
  const user = await createUser(req.body, req.body.userType || "PATIENT");
  return success(res, { userId: user.id }, "Registration completed", 201);
}

async function hospitalSignUp(req, res) {
  const user = await createUser(req.body, "HOSPITAL");
  return success(res, { userId: user.id }, "Hospital registration completed", 201);
}

async function signIn(req, res) {
  const { countryCode, mobileNumber } = normalizePhone(req.body.countryCode, req.body.phoneNumber || req.body.mobileNumber);
  const user = await User.findOne({ countryCode, mobileNumber });
  if (!user) return error(res, "Invalid phone number or password", 401);
  const valid = await bcrypt.compare(req.body.password || "", user.passwordHash);
  if (!valid) return error(res, "Invalid phone number or password", 401);

  const authTokens = tokens(user);
  return success(res, {
    ...authTokens,
    userId: user.id,
    user: {
      id: user.id,
      roles: user.roles,
      userType: user.userType,
      userDetails: { id: user.id, firstName: user.firstName, lastName: user.lastName },
    },
  }, "Login successful");
}

async function adminSignIn(req, res) {
  const { countryCode, mobileNumber } = normalizePhone(req.body.countryCode, req.body.phoneNumber || req.body.mobileNumber);
  const user = await User.findOne({ countryCode, mobileNumber, userType: "ADMIN" });
  if (!user) return error(res, "Invalid admin credentials", 401);
  const valid = await bcrypt.compare(req.body.password || "", user.passwordHash);
  if (!valid) return error(res, "Invalid admin credentials", 401);
  return success(res, {
    ...tokens(user),
    userId: user.id,
    user: {
      id: user.id,
      roles: user.roles,
      userType: null,
      userDetails: { id: user.id, firstName: user.firstName, lastName: user.lastName },
    },
  }, "Admin login successful");
}

async function signOut(_req, res) {
  return success(res, null, "Logged out");
}

async function forgotPassword(req, res) {
  const otp = String(crypto.randomInt(100000, 999999));
  const user = await User.findOneAndUpdate(
    { email: req.body.email },
    { otp, otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    { new: true },
  );
  if (!user) return error(res, "No user found for this email", 404);
  return success(res, { otp }, "OTP generated. In production this should be emailed.");
}

async function verifyOtp(req, res) {
  const user = await User.findOne({ email: req.body.email, otp: req.body.otp, otpExpiresAt: { $gt: new Date() } });
  if (!user) return error(res, "Invalid or expired OTP", 400);
  return success(res, { verified: true }, "OTP verified");
}

async function resetPassword(req, res) {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return error(res, "User not found", 404);
  user.passwordHash = await bcrypt.hash(req.body.password || req.body.newPassword || "Password123", 10);
  user.otp = undefined;
  user.otpExpiresAt = undefined;
  await user.save();
  return success(res, null, "Password reset successful");
}

module.exports = {
  signUp,
  hospitalSignUp,
  signIn,
  adminSignIn,
  signOut,
  forgotPassword,
  verifyOtp,
  resetPassword,
};

