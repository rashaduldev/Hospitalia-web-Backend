function pagination(req) {
  const page = Math.max(Number(req.query.page || 0), 0);
  const limit = Math.min(Math.max(Number(req.query.limit || req.query.size || 10), 1), 100);
  return { page, limit, skip: page * limit };
}

function textSearch(search, fields) {
  if (!search) return {};
  return {
    $or: fields.map((field) => ({ [field]: { $regex: search, $options: "i" } })),
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = { pagination, textSearch, todayIso };
