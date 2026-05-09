const Counter = require("../models/Counter");

async function nextId(name) {
  const counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return counter.seq;
}

module.exports = { nextId };
