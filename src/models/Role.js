const mongoose = require("mongoose");

const privilegeSchema = new mongoose.Schema(
  {
    id: Number,
    name: String,
    descName: String,
  },
  { _id: false },
);

const roleSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    roleName: { type: String, required: true },
    roleType: { type: String, required: true },
    description: String,
    imageUrl: String,
    privileges: [privilegeSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Role", roleSchema);
