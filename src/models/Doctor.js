const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    userId: { type: Number, required: true, unique: true, index: true },
    status: { type: String, enum: ["IMPORTED", "INVITED", "ACTIVE", "INACTIVE", "SUSPENDED"], default: "ACTIVE" },
    firstName: String,
    lastName: String,
    gender: String,
    email: String,
    phoneNumber: String,
    verified: { type: Boolean, default: false },
    medicalLicenseNumber: String,
    licenseIssuingAuthority: String,
    licenseExpiryDate: String,
    yearsOfExperience: Number,
    qualification: String,
    importedByUserId: Number,
    invitationToken: String,
    professionalInfoResponse: {
      designation: String,
      onmsRegistrationNumber: String,
      professionalStatement: String,
      workPhoneNumber: String,
      fileObjectId: Number,
      departments: [{ id: Number, name: String, hospitalUserId: Number }],
      specialities: [{ id: Number, name: String, description: String }],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Doctor", doctorSchema);
