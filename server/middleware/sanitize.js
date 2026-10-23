/**
 * Best-effort NoSQL-injection protection: strips MongoDB operators
 * ($-prefixed keys) and dotted paths from query strings and JSON bodies.
 */
const clean = (value) => {
  if (Array.isArray(value)) return value.map(clean).filter((v) => v !== undefined);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.')) continue; // drop operator / path keys
      const cleaned = clean(val);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    // An object that only contained operators becomes empty -> remove it entirely
    // so downstream code never receives a truthy but unusable filter value.
    if (Object.keys(out).length === 0) return undefined;
    return out;
  }
  return value;
};

const mongoSanitize = (req, res, next) => {
  // `clean()` removes objects that end up empty (e.g. ?status[$ne]=X), so guard
  // against it returning undefined for empty top-level containers.
  if (req.body && typeof req.body === 'object') req.body = clean(req.body) || {};
  if (req.query && typeof req.query === 'object') req.query = clean(req.query) || {};
  if (req.params && typeof req.params === 'object') req.params = clean(req.params) || {};
  next();
};

module.exports = mongoSanitize;
