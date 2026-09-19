const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const env = require("../config/env");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const Hospital = require("../models/Hospital");
const Speciality = require("../models/Speciality");
const { nextId } = require("../utils/ids");
const { ensureDefaultSpecialities } = require("../utils/defaultSpecialities");
const { success, error } = require("../utils/apiResponse");
const { emailConfigured, sendPasswordResetEmail } = require("../services/email");

function normalizePhone(countryCode = "+880", phoneNumber = "") {
  return {
    countryCode,
    mobileNumber: String(phoneNumber).replace(/^\+?880/, "").replace(/^0/, ""),
  };
}

function tokens(user) {
  const payload = { sub: user.id, userType: user.userType, roles: user.roles, tv: Number(user.tokenVersion || 0) };
  return {
    accessToken: jwt.sign(payload, env.jwtAccessSecret, { expiresIn: env.jwtAccessExpiresIn }),
    refreshToken: jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: env.jwtRefreshExpiresIn }),
  };
}

async function createUser(body, fallbackType) {
  const userId = await nextId("users");
  const countryCode = body.countryCode || "+880";
  const mobileNumber = body.mobileNumber || body.phoneNumber;
  const userType = fallbackType || "PATIENT";
  if (!mobileNumber || !body.password || String(body.password).length < 8) {
    const validationError = Object.assign(
      new Error("A mobile number and password of at least 8 characters are required"),
      { statusCode: 422 },
    );
    throw validationError;
  }
  const normalizedEmail = body.email ? String(body.email).trim().toLowerCase() : undefined;
  const duplicate = await User.findOne({
    $or: [
      { countryCode, mobileNumber },
      ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
    ],
  }).lean();
  if (duplicate) {
    throw Object.assign(new Error("An account already exists with this email or phone number"), { statusCode: 409 });
  }
  let specialities = [];

  if (userType === "DOCTOR") {
    await ensureDefaultSpecialities();
    const specialityIds = [...new Set<number>((body.professionalInfoRequest?.specialityId || []).map((value) => Number(value)))]
      .filter((id) => Number.isInteger(id) && id > 0);
    if (!specialityIds.length) {
      const validationError = Object.assign(
        new Error("At least one speciality is required for doctor registration"),
        { statusCode: 422 },
      );
      throw validationError;
    }

    const records = await Speciality.find({ id: { $in: specialityIds }, status: "ACTIVE" })
      .select("id name -_id")
      .lean();
    if (records.length !== specialityIds.length) {
      const validationError = Object.assign(
        new Error("One or more selected specialities are invalid or inactive"),
        { statusCode: 422 },
      );
      throw validationError;
    }
    specialities = records;
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const user = await User.create({
    id: userId,
    firstName: body.firstName || body.hospitalName || "User",
    lastName: body.lastName || "",
    gender: body.gender || "",
    email: normalizedEmail,
    countryCode,
    mobileNumber,
    passwordHash,
    userType,
    roles: [{ roleName: userType, roleType: userType }],
  });

  if (userType === "DOCTOR") {
    await Doctor.create({
      id: await nextId("doctors"),
      userId,
      firstName: user.firstName,
      lastName: user.lastName,
      gender: user.gender,
      email: user.email,
      phoneNumber: `${countryCode}${mobileNumber}`,
      verified: false,
      professionalInfoResponse: {
        designation: body.professionalInfoRequest?.designation || "Doctor",
        onmsRegistrationNumber: body.professionalInfoRequest?.onmsRegistrationNumber || "",
        professionalStatement: body.professionalInfoRequest?.professionalStatement || "",
        workPhoneNumber: body.professionalInfoRequest?.workPhoneNumber || `${countryCode}${mobileNumber}`,
        specialities,
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
  const requestedType = req.body.userType || "PATIENT";
  if (!["PATIENT", "DOCTOR"].includes(requestedType)) {
    return error(res, "This account type cannot be self-registered", 403);
  }
  const user = await createUser(req.body, requestedType);
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
  if (user.status !== "ACTIVE") return error(res, "This account is not active", 403);
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
  if (user.status !== "ACTIVE") return error(res, "This account is not active", 403);
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
  const emailAddress = String(req.body.email || "").trim().toLowerCase();
  const user = await User.findOne({ email: emailAddress });
  if (!user) return success(res, null, "If the address is registered, a reset code has been sent");
  if (env.nodeEnv === "production" && !emailConfigured()) {
    return error(res, "Password reset email delivery is not configured", 503);
  }
  if (emailConfigured()) await sendPasswordResetEmail(emailAddress, otp);
  user.otp = otp;
  user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();
  if (env.nodeEnv === "production") {
    return success(res, null, "If the address is registered, a reset code has been sent");
  }
  return success(res, { otp }, "Development reset code generated");
}

async function verifyOtp(req, res) {
  const user = await User.findOne({ email: req.body.email, otp: req.body.otp, otpExpiresAt: { $gt: new Date() } });
  if (!user) return error(res, "Invalid or expired OTP", 400);
  const resetToken = jwt.sign(
    { sub: user.id, purpose: "password-reset", pwd: crypto.createHash("sha256").update(user.passwordHash).digest("hex") },
    env.jwtAccessSecret,
    { expiresIn: "10m" },
  );
  user.otp = undefined;
  user.otpExpiresAt = undefined;
  await user.save();
  return success(res, { verified: true, resetToken }, "OTP verified");
}

async function resetPassword(req, res) {
  const password = req.body.password || req.body.newPassword;
  if (!password || String(password).length < 8) return error(res, "Password must be at least 8 characters", 422);
  let decoded;
  try {
    decoded = jwt.verify(String(req.body.resetToken || ""), env.jwtAccessSecret);
  } catch {
    return error(res, "Invalid or expired password reset token", 401);
  }
  if (decoded.purpose !== "password-reset") return error(res, "Invalid password reset token", 401);
  const user = await User.findOne({ id: Number(decoded.sub), email: req.body.email });
  if (!user) return error(res, "Invalid password reset token", 401);
  const passwordDigest = crypto.createHash("sha256").update(user.passwordHash).digest("hex");
  if (passwordDigest !== decoded.pwd) return error(res, "Password reset token has already been used", 401);
  user.passwordHash = await bcrypt.hash(password, 12);
  user.tokenVersion = Number(user.tokenVersion || 0) + 1;
  await user.save();
  return success(res, { userType: user.userType }, "Password reset successful");
}

async function changePassword(req, res) {
  const currentPassword = String(req.body.currentPassword || "");
  const newPassword = String(req.body.newPassword || "");
  if (newPassword.length < 8) return error(res, "Password must be at least 8 characters", 422);
  const user = await User.findOne({ id: req.user.id });
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return error(res, "Current password is incorrect", 401);
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.tokenVersion = Number(user.tokenVersion || 0) + 1;
  await user.save();
  return success(res, tokens(user), "Password changed successfully");
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
  changePassword,
};

