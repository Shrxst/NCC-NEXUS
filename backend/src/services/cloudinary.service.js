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

const uploadToCloudinary = (buffer, folder = "ncc-nexus") => {
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
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      )
      .end(buffer);
  });
};

module.exports = { uploadToCloudinary };
