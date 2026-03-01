const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isConfigured = () => Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const randomPassword = () => {
  const base = crypto.randomBytes(24).toString("base64url");
  return `Ncc_${base}_A1!`;
};

const createAuthUser = async ({ email, role }) => {
  if (!isConfigured()) return null;
  if (!email) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password: randomPassword(),
      email_confirm: true,
      app_metadata: role ? { role } : undefined,
    }),
  });

  if (response.ok) {
    const payload = await response.json();
    return payload?.id || null;
  }

  const text = await response.text();
  if (response.status === 422 || response.status === 409) {
    return null;
  }

  const err = new Error(`Supabase auth user create failed: ${text || response.statusText}`);
  err.status = 502;
  throw err;
};

module.exports = {
  isConfigured,
  createAuthUser,
};
