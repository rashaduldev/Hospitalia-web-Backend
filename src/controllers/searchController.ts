const Doctor = require("../models/Doctor");
const Hospital = require("../models/Hospital");
const Location = require("../models/Location");
const { success, paginated } = require("../utils/apiResponse");

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenSearch(value, fields) {
  const tokens = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
  if (!tokens.length) return {};
  return {
    $and: tokens.map((token) => ({
      $or: fields.map((field) => ({
        [field]: { $regex: escapeRegex(token), $options: "i" },
      })),
    })),
  };
}

function pageOptions(req) {
  const page = Math.max(Number(req.query.pageNo ?? req.query.page ?? 0) || 0, 0);
  const limit = Math.min(Math.max(Number(req.query.pageSize ?? req.query.limit ?? req.query.size ?? 10) || 10, 1), 100);
  return { page, limit, skip: page * limit };
}

function locationNamesByOwner(locations, id, userId, owner) {
  return locations
    .filter((location) => Number(location[`${owner}Id`]) === Number(id)
      || Number(location[`${owner}UserId`]) === Number(userId))
    .map((location) => location.locationName)
    .filter(Boolean);
}

async function globalSearch(req, res) {
  const q = req.query.searchKeyword || req.query.q || req.query.search || req.body?.searchKeyword || req.body?.search || "";
  const city = req.query.city || req.body?.city;
  const requestedType = String(req.query.searchType || req.body?.searchType || "").toUpperCase();

  // Preserve the original broad-search response for older API consumers.
  if (!requestedType) {
    const doctorFilter = {
      verified: true,
      status: "ACTIVE",
      ...tokenSearch(q, [
        "firstName",
        "lastName",
        "professionalInfoResponse.designation",
        "professionalInfoResponse.specialities.name",
      ]),
    };
    const hospitalFilter = tokenSearch(q, ["hospitalName"]);
    const [doctors, hospitals, locations] = await Promise.all([
      Doctor.find(doctorFilter).select("-invitationToken -invitationExpiresAt -importedByUserId -__v").limit(20).lean(),
      Hospital.find(hospitalFilter).limit(20).lean(),
      city && city !== "ALL" ? Location.find({ city: { $regex: escapeRegex(city), $options: "i" } }).lean() : [],
    ]);
    return success(res, { doctors, hospitals, locations }, "Search results fetched");
  }

  const { page, limit, skip } = pageOptions(req);
  const cityFilter = city && city !== "ALL"
    ? { city: { $regex: `^${escapeRegex(city)}$`, $options: "i" } }
    : {};

  if (requestedType === "HOSPITAL") {
    const cityLocations = city && city !== "ALL"
      ? await Location.find({ ...cityFilter, $or: [{ hospitalId: { $ne: null } }, { hospitalUserId: { $ne: null } }] }).lean()
      : [];
    const filter = {
      ...tokenSearch(q, ["hospitalName"]),
      ...(city && city !== "ALL" ? {
        $or: [
          { id: { $in: cityLocations.map((item) => item.hospitalId).filter(Number.isFinite) } },
          { userId: { $in: cityLocations.map((item) => item.hospitalUserId).filter(Number.isFinite) } },
        ],
      } : {}),
    };
    const [items, total] = await Promise.all([
      Hospital.find(filter).sort({ hospitalName: 1 }).skip(skip).limit(limit).lean(),
      Hospital.countDocuments(filter),
    ]);
    const locations = await Location.find({
      $or: [
        { hospitalId: { $in: items.map((item) => item.id) } },
        { hospitalUserId: { $in: items.map((item) => item.userId) } },
      ],
      ...cityFilter,
    }).lean();
    const content = items.map((item) => ({
      userId: item.userId,
      hospitalId: item.id,
      name: item.hospitalName || "Hospital",
      designation: item.hospitalType || "Hospital",
      specialities: Array.isArray(item.professionalInfoResponse?.specialities)
        ? item.professionalInfoResponse.specialities.map((entry) => entry.name).filter(Boolean)
        : [],
      locationName: locationNamesByOwner(locations, item.id, item.userId, "hospital"),
    }));
    return success(res, paginated(content, page, limit, total), "Hospital search results fetched");
  }

  const cityLocations = city && city !== "ALL"
    ? await Location.find({ ...cityFilter, $or: [{ doctorId: { $ne: null } }, { doctorUserId: { $ne: null } }] }).lean()
    : [];
  const doctorFilter: Record<string, any> = q
    ? { verified: true, status: "ACTIVE", ...tokenSearch(q, [
      "firstName",
      "lastName",
      "professionalInfoResponse.designation",
      "professionalInfoResponse.specialities.name",
    ]) }
    : { verified: true, status: "ACTIVE" };
  if (city && city !== "ALL") {
    doctorFilter.$or = [
      { id: { $in: cityLocations.map((item) => item.doctorId).filter(Number.isFinite) } },
      { userId: { $in: cityLocations.map((item) => item.doctorUserId).filter(Number.isFinite) } },
    ];
  }
  const [items, total] = await Promise.all([
    Doctor.find(doctorFilter).sort({ firstName: 1, lastName: 1 }).skip(skip).limit(limit).lean(),
    Doctor.countDocuments(doctorFilter),
  ]);
  const locations = await Location.find({
    $or: [
      { doctorId: { $in: items.map((item) => item.id) } },
      { doctorUserId: { $in: items.map((item) => item.userId) } },
    ],
    ...cityFilter,
  }).lean();
  const content = items.map((item) => ({
    userId: item.userId,
    doctorId: item.id,
    name: [item.firstName, item.lastName].filter(Boolean).join(" ") || "Doctor",
    designation: item.professionalInfoResponse?.designation || "Doctor",
    specialities: Array.isArray(item.professionalInfoResponse?.specialities)
      ? item.professionalInfoResponse.specialities.map((entry) => entry.name).filter(Boolean)
      : [],
    locationName: locationNamesByOwner(locations, item.id, item.userId, "doctor"),
  }));
  return success(res, paginated(content, page, limit, total), "Doctor search results fetched");
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

