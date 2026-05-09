const Doctor = require("../models/Doctor");
const Hospital = require("../models/Hospital");
const Location = require("../models/Location");
const { success } = require("../utils/apiResponse");

async function globalSearch(req, res) {
  const q = req.query.q || req.query.search || req.body?.search || "";
  const city = req.query.city || req.body?.city;
  const doctorFilter = q
    ? { $or: [
      { firstName: { $regex: q, $options: "i" } },
      { lastName: { $regex: q, $options: "i" } },
      { "professionalInfoResponse.designation": { $regex: q, $options: "i" } },
      { "professionalInfoResponse.specialities.name": { $regex: q, $options: "i" } },
    ] }
    : {};
  const hospitalFilter = q ? { hospitalName: { $regex: q, $options: "i" } } : {};
  const [doctors, hospitals] = await Promise.all([
    Doctor.find(doctorFilter).limit(20).lean(),
    Hospital.find(hospitalFilter).limit(20).lean(),
  ]);
  const locations = city ? await Location.find({ city: { $regex: city, $options: "i" } }).lean() : [];
  return success(res, { doctors, hospitals, locations }, "Search results fetched");
}

async function doctorCities(_req, res) {
  const cities = await Location.distinct("city", { doctorId: { $exists: true, $ne: null } });
  return success(res, cities.filter(Boolean), "Doctor cities fetched");
}

async function hospitalCities(_req, res) {
  const cities = await Location.distinct("city", { hospitalId: { $exists: true, $ne: null } });
  return success(res, cities.filter(Boolean), "Hospital cities fetched");
}

module.exports = { globalSearch, doctorCities, hospitalCities };
