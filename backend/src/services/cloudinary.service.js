const cloudinary = require("cloudinary").v2;

const CLOUDINARY_CONFIG = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};

cloudinary.config(CLOUDINARY_CONFIG);

const ensureCloudinaryConfigured = () => {
  const missing = Object.entries(CLOUDINARY_CONFIG)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Cloudinary config missing: ${missing.join(", ")}`);
  }
};

const uploadToCloudinary = (buffer, folder = "ncc-nexus", uploadOptions = {}) => {
  ensureCloudinaryConfigured();

  if (!buffer) {
    throw new Error("No file buffer provided for upload");
  }

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: "auto",
          ...uploadOptions,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      )
      .end(buffer);
  });
};

const extractRawPdfPublicId = (url) => {
  if (!url || typeof url !== "string") return null;
  try {
    const normalized = decodeURIComponent(url.split("?")[0].split("#")[0]);
    const uploadMarker = "/raw/upload/";
    const authMarker = "/raw/authenticated/";
    const privateMarker = "/raw/private/";
    const markerIndex = normalized.includes(uploadMarker)
      ? normalized.indexOf(uploadMarker) + uploadMarker.length
      : normalized.includes(authMarker)
        ? normalized.indexOf(authMarker) + authMarker.length
        : normalized.includes(privateMarker)
          ? normalized.indexOf(privateMarker) + privateMarker.length
        : -1;
    if (markerIndex === -1) return null;

    const pathPart = normalized.slice(markerIndex);
    const withoutVersion = pathPart.replace(/^v\d+\//, "");
    return withoutVersion || null;
  } catch {
    return null;
  }
};

const resolveRawPdfAsset = async (rawUrl) => {
  const extracted = extractRawPdfPublicId(rawUrl);
  if (!extracted) return null;

  const candidates = Array.from(
    new Set(
      [extracted, extracted.toLowerCase().endsWith(".pdf") ? extracted.slice(0, -4) : null].filter(Boolean)
    )
  );
  const types = ["upload", "authenticated", "private"];

  for (const type of types) {
    for (const publicId of candidates) {
      try {
        const asset = await cloudinary.api.resource(publicId, {
          resource_type: "raw",
          type,
        });
        if (asset?.public_id) {
          return {
            public_id: asset.public_id,
            type,
          };
        }
      } catch {
        // Continue probing other candidate/type combinations.
      }
    }
  }

  return null;
};

const buildSignedPdfUrl = async (rawUrl, filename = "document.pdf") => {
  try {
    ensureCloudinaryConfigured();
  } catch {
    return rawUrl;
  }
  const asset = await resolveRawPdfAsset(rawUrl);
  if (!asset?.public_id) return rawUrl;

  try {
    return cloudinary.utils.private_download_url(asset.public_id, "pdf", {
      resource_type: "raw",
      type: asset.type || "upload",
      attachment: filename,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    });
  } catch {
    return rawUrl;
  }
};

module.exports = {
  uploadToCloudinary,
  buildSignedPdfUrl,
};
