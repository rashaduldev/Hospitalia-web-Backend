const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    locationId: { type: Number, index: true },
    doctorId: { type: Number, index: true },
    doctorUserId: { type: Number, index: true },
    hospitalId: { type: Number, index: true },
    hospitalUserId: { type: Number, index: true },
    locationName: { type: String, required: true },
    address: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
    latitude: Number,
    longitude: Number,
    fees: { type: Number, default: 0 },
    newPatientFee: { type: Number, default: 0 },
    oldPatientFee: { type: Number, default: 0 },
    feeCurrency: { type: String, default: "XOF" },
    supportedAppointmentTypeIds: [{ type: Number }],
    supportedAppointmentTypes: [
      {
        id: Number,
        name: String,
        description: String,
      },
    ],
    active: { type: Boolean, default: true },
  },
  { timestamps: true, strict: false },
);

module.exports = mongoose.model("Location", locationSchema);

