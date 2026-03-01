const jwt = require("jsonwebtoken");
const repo = require("./leave.repository");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const buildBearerToken = (req) => {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
};

const resolveLocalJwt = (token) => {
  if (!process.env.JWT_SECRET) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
};

const resolveSupabaseIdentity = async (token) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;
  const payload = await response.json();
  if (!payload?.id) return null;

  return {
    auth_user_id: payload.id,
    email: payload.email || null,
    app_role:
      payload?.app_metadata?.role ||
      payload?.user_metadata?.role ||
      payload?.role ||
      null,
  };
};

const authenticateLeaveUser = async (req, res, next) => {
  try {
    const token = buildBearerToken(req);
    if (!token) {
      return res.status(401).json({ message: "Authorization header missing or malformed." });
    }

    const local = resolveLocalJwt(token);
    if (local?.user_id && local?.role) {
      req.user = local;
      return next();
    }

    const supabaseIdentity = await resolveSupabaseIdentity(token);
    if (!supabaseIdentity) {
      return res.status(401).json({ message: "Invalid or expired token." });
    }

    const profile = await repo.getUserAuthContextBySupabaseIdentity({
      authUserId: supabaseIdentity.auth_user_id,
      email: supabaseIdentity.email,
    });

    if (!profile) {
      return res.status(403).json({ message: "User is not mapped to an application account." });
    }

    req.user = {
      user_id: profile.user_id,
      role: profile.role,
      rank: profile.rank_name || null,
      regimental_no: profile.regimental_no || null,
      auth_user_id: profile.auth_user_id || supabaseIdentity.auth_user_id,
      auth_role: supabaseIdentity.app_role || null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({ message: "Authentication failed." });
  }
};

module.exports = {
  authenticateLeaveUser,
};
