// Small helpers for admin list endpoints.
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function paging(q) {
  const page = Math.max(1, Math.floor(Number(q.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(q.limit) || 25)));
  return { page, limit, skip: (page - 1) * limit };
}

// Case-insensitive "contains" search over several fields.
function searchFilter(q, fields) {
  const term = String(q || "").trim().slice(0, 80);
  if (!term) return {};
  const re = new RegExp(escapeRegex(term), "i");
  return { $or: fields.map((f) => ({ [f]: re })) };
}

module.exports = { escapeRegex, paging, searchFilter };
