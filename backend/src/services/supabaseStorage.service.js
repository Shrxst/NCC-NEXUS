const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LEAVE_BUCKET = process.env.SUPABASE_LEAVE_BUCKET || "leave-documents";

const assertSupabaseStorageEnv = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const err = new Error(
      "Supabase storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
    err.status = 500;
    throw err;
  }
};

const getAuthHeaders = (contentType = "application/json") => ({
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": contentType,
});

const uploadLeaveDocument = async ({ path, file }) => {
  assertSupabaseStorageEnv();
  const endpoint = `${SUPABASE_URL}/storage/v1/object/${LEAVE_BUCKET}/${path}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": file.mimetype || "application/octet-stream",
      "x-upsert": "false",
    },
    body: file.buffer,
  });

  if (!response.ok) {
    const payload = await response.text();
    const err = new Error(`Leave document upload failed: ${payload || response.statusText}`);
    err.status = 502;
    throw err;
  }

  return { bucket: LEAVE_BUCKET, path };
};

const createSignedDocumentUrl = async ({ path, expiresInSeconds = 300 }) => {
  if (!path) return null;
  assertSupabaseStorageEnv();

  const endpoint = `${SUPABASE_URL}/storage/v1/object/sign/${LEAVE_BUCKET}/${path}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });

  if (!response.ok) {
    const payload = await response.text();
    const err = new Error(`Signed URL generation failed: ${payload || response.statusText}`);
    err.status = 502;
    throw err;
  }

  const data = await response.json();
  if (!data?.signedURL) return null;

  if (String(data.signedURL).startsWith("http")) {
    return data.signedURL;
  }
  return `${SUPABASE_URL}/storage/v1${data.signedURL}`;
};

module.exports = {
  LEAVE_BUCKET,
  uploadLeaveDocument,
  createSignedDocumentUrl,
};
