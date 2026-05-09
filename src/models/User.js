const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    gender: { type: String, enum: ["MALE", "FEMALE", "OTHER", ""], default: "" },
    email: { type: String, lowercase: true, trim: true, index: true },
    countryCode: { type: String, default: "+880" },
    mobileNumber: { type: String, required: true, index: true },
    passwordHash: { type: String, required: true },
    userType: {
      type: String,
      enum: ["DOCTOR", "PATIENT", "HOSPITAL", "SECRETARY", "ADMIN"],
      required: true,
      index: true,
    },
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING", "INVITED"], default: "ACTIVE" },
    profileImage: String,
    roles: [
      {
        roleName: String,
        roleType: String,
      },
    ],
    dateOfBirth: String,
    otp: String,
    otpExpiresAt: Date,
  },
  { timestamps: true },
);

userSchema.index({ countryCode: 1, mobileNumber: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
