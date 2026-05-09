function success(res, payload = null, message = "Request completed successfully", statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    status: "success",
    message,
    payload,
  });
}

function error(res, message = "Something went wrong", statusCode = 500, payload = null) {
  return res.status(statusCode).json({
    success: false,
    status: "error",
    message,
    payload,
  });
}

function paginated(content, page = 0, limit = 10, total = 0) {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;
  return {
    content,
    page,
    limit,
    total,
    totalElements: total,
    totalPages,
    numberOfElements: content.length,
    first: page <= 0,
    last: page + 1 >= totalPages,
  };
}

module.exports = { success, error, paginated };

