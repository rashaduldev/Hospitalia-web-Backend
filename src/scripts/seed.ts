const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const Counter = require("../models/Counter");
const User = require("../models/User");
const Role = require("../models/Role");
const Speciality = require("../models/Speciality");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const Hospital = require("../models/Hospital");
const Location = require("../models/Location");
const Availability = require("../models/Availability");
const Appointment = require("../models/Appointment");
const Secretary = require("../models/Secretary");
const SecretaryLocation = require("../models/SecretaryLocation");
const HospitalDoctor = require("../models/HospitalDoctor");
const ChatThread = require("../models/ChatThread");
const Beneficiary = require("../models/Beneficiary");
const UnavailableDate = require("../models/UnavailableDate");

const collections = [
  Counter,
  User,
  Role,
  Speciality,
  Doctor,
  Patient,
  Hospital,
  Location,
  Availability,
  Appointment,
  Secretary,
  SecretaryLocation,
  HospitalDoctor,
  ChatThread,
  Beneficiary,
  UnavailableDate,
];

async function setCounter(name, seq) {
  await Counter.updateOne({ name }, { name, seq }, { upsert: true });
}

async function run() {
  await connectDB();
  for (const model of collections) {
    await model.deleteMany({});
  }

  const passwordHash = await bcrypt.hash("Password123", 10);

  await User.insertMany([
    {
      id: 1,
      firstName: "System",
      lastName: "Admin",
      gender: "OTHER",
      email: "admin@hospitalia.local",
      countryCode: "+880",
      mobileNumber: "1700000000",
      passwordHash,
      userType: "ADMIN",
      roles: [{ roleName: "Super Admin", roleType: "SUPER_ADMIN" }],
    },
    {
      id: 2,
      firstName: "Amina",
      lastName: "Rahman",
      gender: "FEMALE",
      email: "doctor@hospitalia.local",
      countryCode: "+880",
      mobileNumber: "1711111111",
      passwordHash,
      userType: "DOCTOR",
      roles: [{ roleName: "Doctor", roleType: "DOCTOR" }],
    },
    {
      id: 3,
      firstName: "Karim",
      lastName: "Uddin",
      gender: "MALE",
      email: "patient@hospitalia.local",
      countryCode: "+880",
      mobileNumber: "1722222222",
      passwordHash,
      userType: "PATIENT",
      roles: [{ roleName: "Patient", roleType: "PATIENT" }],
    },
    {
      id: 4,
      firstName: "Dhaka Care Hospital",
      lastName: "",
      gender: "OTHER",
      email: "hospital@hospitalia.local",
      countryCode: "+880",
      mobileNumber: "1733333333",
      passwordHash,
      userType: "HOSPITAL",
      roles: [{ roleName: "Hospital", roleType: "HOSPITAL" }],
    },
    {
      id: 5,
      firstName: "Nadia",
      lastName: "Islam",
      gender: "FEMALE",
      email: "secretary@hospitalia.local",
      countryCode: "+880",
      mobileNumber: "1744444444",
      passwordHash,
      userType: "SECRETARY",
      roles: [{ roleName: "Secretary", roleType: "SECRETARY" }],
    },
  ]);

  await Speciality.insertMany([
    { id: 1, name: "Cardiology", description: "Heart and vascular care" },
    { id: 2, name: "Medicine", description: "General medicine" },
    { id: 3, name: "Pediatrics", description: "Child health" },
  ]);

  await Role.insertMany([
    {
      id: 1,
      roleName: "Super Admin",
      roleType: "SUPER_ADMIN",
      description: "Full platform access",
      privileges: [
        { id: 1, name: "USER_READ", descName: "Read users" },
        { id: 2, name: "USER_WRITE", descName: "Create and update users" },
        { id: 4, name: "SYSTEM_ADMIN", descName: "Manage platform settings" },
      ],
    },
    {
      id: 2,
      roleName: "Doctor",
      roleType: "DOCTOR",
      description: "Doctor dashboard access",
      privileges: [{ id: 3, name: "APPOINTMENT_READ", descName: "Read appointments" }],
    },
  ]);

  await Doctor.create({
    id: 1,
    userId: 2,
    status: "ACTIVE",
    firstName: "Amina",
    lastName: "Rahman",
    gender: "FEMALE",
    email: "doctor@hospitalia.local",
    phoneNumber: "+8801711111111",
    verified: true,
    medicalLicenseNumber: "BMDC-12345",
    yearsOfExperience: 12,
    qualification: "MBBS, FCPS",
    professionalInfoResponse: {
      designation: "Consultant Cardiologist",
      onmsRegistrationNumber: "ONMS-9988",
      professionalStatement: "Focused on preventive cardiac care and long-term patient outcomes.",
      workPhoneNumber: "+8801711111111",
      departments: [{ id: 1, name: "Cardiology", hospitalUserId: 4 }],
      specialities: [{ id: 1, name: "Cardiology" }, { id: 2, name: "Medicine" }],
    },
  });

  await Patient.create({
    id: 1,
    userId: 3,
    firstName: "Karim",
    lastName: "Uddin",
    gender: "MALE",
    email: "patient@hospitalia.local",
    countryCode: "+880",
    mobileNumber: "1722222222",
  });

  await Hospital.create({
    id: 1,
    userId: 4,
    hospitalName: "Dhaka Care Hospital",
    hospitalType: "GENERAL",
    workPhoneNumber: "+8801733333333",
    websiteUrl: "https://hospitalia.local",
    numberOfBeds: 120,
    foundedYear: 2012,
    email: "hospital@hospitalia.local",
    professionalInfoResponse: {
      onmsRegistrationNumber: "HOSP-4400",
      professionalStatement: "Multi-speciality care in Dhaka.",
      specialities: [{ id: 1, name: "Cardiology" }, { id: 2, name: "Medicine" }],
      departments: [{ id: 1, name: "Cardiology" }, { id: 2, name: "Medicine" }],
    },
  });

  await Location.insertMany([
    {
      id: 1,
      doctorId: 1,
      doctorUserId: 2,
      hospitalId: 1,
      hospitalUserId: 4,
      locationName: "Dhaka Care Hospital, Dhanmondi",
      address: "Road 27, Dhanmondi",
      city: "Dhaka",
      country: "Bangladesh",
      fees: 1200,
    },
    {
      id: 2,
      hospitalId: 1,
      hospitalUserId: 4,
      locationName: "Dhaka Care Hospital, Uttara",
      address: "Sector 7, Uttara",
      city: "Dhaka",
      country: "Bangladesh",
      fees: 1000,
    },
  ]);

  await Availability.insertMany([
    { id: 1, doctorId: 1, doctorLocationId: 1, dayOfWeek: "MONDAY", startTime: "09:00", endTime: "09:30", slotDuration: 30, fees: 1200 },
    { id: 2, doctorId: 1, doctorLocationId: 1, dayOfWeek: "MONDAY", startTime: "09:30", endTime: "10:00", slotDuration: 30, fees: 1200 },
    { id: 3, doctorId: 1, doctorLocationId: 1, dayOfWeek: "TUESDAY", startTime: "11:00", endTime: "11:30", slotDuration: 30, fees: 1200 },
  ]);

  await HospitalDoctor.create({ id: 1, hospitalId: 1, hospitalUserId: 4, doctorId: 1, doctorUserId: 2 });
  await Secretary.create({
    id: 1,
    userId: 5,
    doctorUserId: 2,
    doctorId: 1,
    status: "ACTIVE",
    firstName: "Nadia",
    lastName: "Islam",
    gender: "FEMALE",
    email: "secretary@hospitalia.local",
    phoneNumber: "+8801744444444",
  });
  await SecretaryLocation.create({
    id: 1,
    userId: 5,
    locationId: 1,
    locationName: "Dhaka Care Hospital, Dhanmondi",
    city: "Dhaka",
    doctorId: 1,
    doctorName: "Amina Rahman",
    permissions: ["SECRETARY_DASHBOARD_READ", "SECRETARY_APPOINTMENT_READ", "SECRETARY_APPOINTMENT_UPDATE"],
  });

  await ChatThread.create({
    id: 1,
    doctorUserId: 2,
    patientUserId: 3,
    subject: "Appointment question",
    messages: [{ id: 1, senderUserId: 3, body: "Can I book a morning slot?", createdAt: new Date() }],
  });

  await Promise.all([
    setCounter("users", 5),
    setCounter("specialities", 3),
    setCounter("roles", 2),
    setCounter("doctors", 1),
    setCounter("patients", 1),
    setCounter("hospitals", 1),
    setCounter("locations", 2),
    setCounter("availability", 3),
    setCounter("appointments", 0),
    setCounter("secretaries", 1),
    setCounter("secretaryLocations", 1),
    setCounter("hospitalDoctors", 1),
    setCounter("chatThreads", 1),
    setCounter("chatMessages", 1),
    setCounter("beneficiaries", 0),
    setCounter("unavailableDates", 0),
  ]);

  console.info("Hospitalia backend seed completed.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

