// src/middleware/auth.js
const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
  // Accept token from Authorization header OR query param (for PDF download links)
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : queryToken;

  if (!token) {
    return res.status(401).json({ error: "No token provided. Please log in." });
  }
  try {
    req.user   = jwt.verify(token, process.env.JWT_SECRET);
    req.campus = req.headers["x-campus"] || req.user.campus || "swla";
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token. Please log in again." });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: "You do not have permission to perform this action." });
  }
  next();
};

module.exports = { authenticate, authorize };
