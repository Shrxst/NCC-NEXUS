const AUTH_KEYS = ["token", "role", "system_role", "rank", "user"];

const ROLE_VALUES = ["CADET", "SUO", "ALUMNI", "ANO"];

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function decodeJwtPayload(token) {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const normalized = atob(base64);
    return JSON.parse(normalized);
  } catch {
    return null;
  }
}

function normalizeRole(value) {
  if (!value) return "";
  const upper = String(value).trim().toUpperCase();
  if (upper === "SENIOR UNDER OFFICER") return "SUO";
  return upper;
}

export function getStoredRole() {
  const directRole = normalizeRole(localStorage.getItem("role"));
  if (ROLE_VALUES.includes(directRole)) return directRole;

  const systemRole = normalizeRole(localStorage.getItem("system_role"));
  if (ROLE_VALUES.includes(systemRole)) return systemRole;

  const rank = normalizeRole(localStorage.getItem("rank"));
  if (rank === "SUO") return "SUO";

  const user = safeJsonParse(localStorage.getItem("user"));
  const userRole = normalizeRole(user?.role);
  if (ROLE_VALUES.includes(userRole)) return userRole;

  const tokenRole = normalizeRole(decodeJwtPayload(localStorage.getItem("token"))?.role);
  if (ROLE_VALUES.includes(tokenRole)) return tokenRole;

  return "";
}

export function hasAuthFor(allowedRoles = []) {
  const token = localStorage.getItem("token");
  const role = getStoredRole();
  return Boolean(token && allowedRoles.includes(role));
}

export function clearAuthStorage() {
  AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
}
