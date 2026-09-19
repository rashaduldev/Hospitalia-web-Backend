const mongoose = require("mongoose");

const appointmentSlotReservationSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    doctorId: { type: Number, required: true },
    locationId: { type: Number, required: true },
    appointmentDate: { type: String, required: true },
    startTime: { type: String, required: true },
    patientUserId: Number,
    appointmentId: Number,
    // A short hold is written first and extended after the appointment exists.
    // MongoDB removes abandoned holds; cancellation removes confirmed holds.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AppointmentSlotReservation", appointmentSlotReservationSchema);
