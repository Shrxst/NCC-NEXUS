const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth.middleware");
const { authorizeRole } = require("../middlewares/authorize.middleware");
const AnoController = require("../controllers/ano.controller");

// Middleware wrapper for all ANO routes
const protectAno = [authenticate, authorizeRole("ANO")];

// Dashboard Stats
router.get("/dashboard/stats", protectAno, AnoController.getDashboardStats);

// Cadet Management
router.get("/cadets", protectAno, AnoController.getCadets);
router.post("/cadets", protectAno, AnoController.addCadet);
router.get("/cadets/search", protectAno, AnoController.searchCadets);
router.put("/cadets/:regimental_no", protectAno, AnoController.updateCadet);
router.delete("/cadets/:regimental_no", protectAno, AnoController.deleteCadet);

module.exports = router;