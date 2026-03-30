const express = require("express");
const router = express.Router();
const axios = require("axios");
const FormData = require("form-data");
const upload = require("../middlewares/upload.middleware");

router.post("/analyze", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Audio file is required",
      });
    }

    const formData = new FormData();
    formData.append("file", req.file.buffer, {
      filename: req.file.originalname || "voice-command.webm",
      contentType: req.file.mimetype || "audio/webm",
    });

    const response = await axios.post(
      "http://127.0.0.1:8000/analyze",
      formData,
      {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    return res.json(response.data);
  } catch (error) {
    const status = error.response?.status || (error.code === "ECONNREFUSED" ? 503 : 500);
    const message =
      error.response?.data?.message ||
      error.response?.data?.detail ||
      (error.code === "ECONNREFUSED"
        ? "Voice analysis service is unavailable"
        : "Voice analysis failed");

    console.error("Voice API Error:", message, error.code || error.message);
    return res.status(status).json({
      message,
    });
  }
});

module.exports = router;
