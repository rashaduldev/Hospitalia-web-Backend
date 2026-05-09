const mongoose = require("mongoose");

const hospitalSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    userId: { type: Number, required: true, unique: true, index: true },
    hospitalName: String,
    hospitalType: String,
    workPhoneNumber: String,
    websiteUrl: String,
    numberOfBeds: Number,
    foundedYear: Number,
    email: String,
    countryCode: String,
    mobileNumber: String,
    professionalInfoResponse: {
      onmsRegistrationNumber: String,
      professionalStatement: String,
      fileObjectId: Number,
      specialities: [{ id: Number, name: String, description: String }],
      departments: [{ id: Number, name: String }],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Hospital", hospitalSchema);
