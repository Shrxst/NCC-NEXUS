const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth.middleware");
const donationController = require("../controllers/donation.controller");

router.post(
  "/campaign",
  authenticate,
  donationController.createCampaign
);

router.get(
  "/campaigns",
  authenticate,
  donationController.getCampaigns
);

router.patch(
  "/campaign/:campaign_id/close",
  authenticate,
  donationController.closeCampaign
);


router.post(
  "/create-order",
  authenticate,
  donationController.createOrder
);

router.post(
  "/verify",
  authenticate,
  donationController.verifyPayment
);


router.get(
  "/leaderboard",
  authenticate,
  donationController.getLeaderboard
);

router.get(
  "/history",
  authenticate,
  donationController.getDonationHistory
);

module.exports = router;