const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    appointmentId: { type: Number, unique: true, index: true },
    doctorId: { type: Number, required: true, index: true },
    doctorUserId: { type: Number, index: true },
    patientUserId: { type: Number, index: true },
    patientType: { type: String, enum: ["new", "returning", "NEW", "RETURNING"], default: "new" },
    appointmentTypeId: Number,
    doctorName: String,
    designation: String,
    patientName: String,
    patientGender: String,
    patientAge: Number,
    patientPhone: String,
    patientEmail: String,
    appointmentDate: { type: String, required: true, index: true },
    dayOfWeek: String,
    locationId: Number,
    locationName: String,
    startTime: String,
    endTime: String,
    slotDuration: Number,
    fees: Number,
    notes: String,
    bookingSource: { type: String, enum: ["PATIENT", "DOCTOR", "SECRETARY"], default: "PATIENT" },
    bookedByUserId: Number,
    appointmentStatus: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"],
      default: "PENDING",
    },
    cancellationReason: String,
    cancelledAt: Date,
    cancelledByUserId: Number,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Appointment", appointmentSchema);

