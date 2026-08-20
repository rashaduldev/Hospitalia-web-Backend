const Speciality = require("../models/Speciality");
const { nextId } = require("./ids");

const DEFAULT_SPECIALITIES = [
  { name: "Cardiology", description: "Heart and vascular care" },
  { name: "Medicine", description: "General medicine and primary care" },
  { name: "Pediatrics", description: "Child health care" },
  { name: "Dermatology", description: "Skin, hair and nail care" },
  { name: "Gynecology and Obstetrics", description: "Women's reproductive health and maternity care" },
  { name: "Orthopedics", description: "Bones, joints and musculoskeletal care" },
  { name: "Neurology", description: "Brain, spine and nervous system care" },
  { name: "Ophthalmology", description: "Eye care and vision services" },
  { name: "ENT", description: "Ear, nose and throat care" },
  { name: "Psychiatry", description: "Mental health care" },
];

/** Creates the starter catalogue once, without changing any existing speciality. */
async function ensureDefaultSpecialities() {
  for (const speciality of DEFAULT_SPECIALITIES) {
    const exists = await Speciality.exists({ name: speciality.name });
    if (!exists) {
      await Speciality.create({
        ...speciality,
        id: await nextId("specialities"),
        status: "ACTIVE",
      });
    }
  }
}

module.exports = { ensureDefaultSpecialities, DEFAULT_SPECIALITIES };
