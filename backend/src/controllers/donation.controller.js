const db = require("../db/knex");
const { 
  createPaymentOrder, 
  verifyPayment: verifyPaymentService 
} = require("../services/payment.service");

const createCampaign = async (req, res) => {
  try {

    if (req.user.role !== "ANO") {
      return res.status(403).json({
        message: "Only ANO can create donation campaigns"
      });
    }

    const {
      title,
      description,
      minimum_amount,
      target_amount
    } = req.body;

    if (!title || minimum_amount === undefined) {
      return res.status(400).json({
        message: "Title and minimum_amount are required"
      });
    }

    if (Number(minimum_amount) < 0) {
      return res.status(400).json({
        message: "Minimum amount cannot be negative"
      });
    }

    if (target_amount && Number(target_amount) < 0) {
      return res.status(400).json({
        message: "Target amount cannot be negative"
      });
    }


    const [campaign] = await db("donation_campaigns")
      .insert({
        college_id: req.user.college_id,
        title,
        description,
        minimum_amount,
        target_amount: target_amount || null,
        campaign_type: "EVENT",
        status: "ACTIVE",
        created_by_user_id: req.user.user_id
      })
      .returning("*");

    return res.status(201).json({
      success: true,
      message: "Campaign created successfully",
      data: campaign
    });

  } catch (err) {
    console.error("Create Campaign Error:", err);
    return res.status(500).json({ error: err.message });
  }
};

const getCampaigns = async (req, res) => {
  try {

    const campaigns = await db("donation_campaigns")
      .where({
        college_id: req.user.college_id
      })
      .whereNull("deleted_at")
      .orderBy([
        { column: "campaign_type", order: "asc" }, // DEFAULT first
        { column: "created_at", order: "desc" }     // newest events first
      ]);

    res.json({
      success: true,
      data: campaigns
    });

  } catch (err) {
    console.error("Get Campaigns Error:", err);
    res.status(500).json({ error: err.message });
  }
};

const createOrder = async (req, res) => {
  try {

    if (req.user.role !== "ALUMNI") {
      return res.status(403).json({
        message: "Only Alumni can make donations"
      });
    }

    const { campaign_id, amount, is_anonymous } = req.body;

    if (!campaign_id || !amount) {
      return res.status(400).json({
        message: "campaign_id and amount are required"
      });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({
        message: "Amount must be greater than zero"
      });
    }

    const campaign = await db("donation_campaigns")
      .where({
        campaign_id,
        college_id: req.user.college_id
      })
      .whereNull("deleted_at")
      .first();

    if (!campaign) {
      return res.status(404).json({
        message: "Campaign not found"
      });
    }

    if (campaign.status !== "ACTIVE") {
      return res.status(400).json({
        message: "Campaign is not active"
      });
    }

    if (
      campaign.campaign_type === "EVENT" &&
      Number(amount) < Number(campaign.minimum_amount)
    ) {
      return res.status(400).json({
        message: `Minimum donation amount is ₹${campaign.minimum_amount}`
      });
    }

    let orderResponse;

    await db.transaction(async (trx) => {

      orderResponse = await createPaymentOrder({
        amount,
        campaign_id,
        user_id: req.user.user_id
      });

      await trx("donations").insert({
        campaign_id,
        alumni_user_id: req.user.user_id,
        amount,
        is_anonymous: is_anonymous || false,
        payment_order_id: orderResponse.order_id,
        payment_status: "PENDING"
      });

    });

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      order: orderResponse
    });

  } catch (err) {
    console.error("Create Order Error:", err);
    return res.status(500).json({ error: err.message });
  }
};

const verifyPayment = async (req, res) => {
  try {

    if (req.user.role !== "ALUMNI") {
      return res.status(403).json({
        message: "Only Alumni can verify donations"
      });
    }

    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({
        message: "order_id is required"
      });
    }

    await db.transaction(async (trx) => {

      const donation = await trx("donations")
        .where({
          payment_order_id: order_id,
          alumni_user_id: req.user.user_id
        })
        .forUpdate()
        .first();

      if (!donation) {
        throw new Error("DONATION_NOT_FOUND");
      }

      if (donation.payment_status === "SUCCESS") {
        throw new Error("ALREADY_VERIFIED");
      }

      if (donation.payment_status !== "PENDING") {
        throw new Error("INVALID_STATE");
      }
      const verification = await verifyPaymentService({ order_id });

      if (!verification.success) {
        throw new Error("VERIFICATION_FAILED");
      }

      await trx("donations")
        .where({ donation_id: donation.donation_id })
        .update({
          payment_status: "SUCCESS",
          payment_id: verification.payment_id,
          payment_signature: verification.signature
        });

      await trx("donation_campaigns")
        .where({ campaign_id: donation.campaign_id })
        .update({
          collected_amount: trx.raw(
            "collected_amount + ?",
            [donation.amount]
          )
        });

      const anos = await trx("users")
        .where({
          role: "ANO",
          college_id: req.user.college_id
        })
        .select("user_id");

      for (const ano of anos) {
        await trx("notifications").insert({
          user_id: ano.user_id,
          type: "donation",
          message: `New donation of ₹${donation.amount} received.`,
          is_read: false
        });
      }

    });

    return res.json({
      success: true,
      message: "Payment verified and donation successful"
    });

  } catch (err) {

    if (err.message === "ALREADY_VERIFIED") {
      return res.status(400).json({
        message: "Donation already verified"
      });
    }

    if (err.message === "DONATION_NOT_FOUND") {
      return res.status(404).json({
        message: "Donation not found"
      });
    }

    if (err.message === "INVALID_STATE") {
      return res.status(400).json({
        message: "Invalid donation state"
      });
    }

    if (err.message === "VERIFICATION_FAILED") {
      return res.status(400).json({
        message: "Payment verification failed"
      });
    }

    console.error("Verify Payment Error:", err);
    return res.status(500).json({
      error: "Internal server error"
    });
  }
};

const getLeaderboard = async (req, res) => {
  try {

    const leaderboard = await db("donations as d")
      .join("users as u", "u.user_id", "d.alumni_user_id")
      .join("donation_campaigns as dc", "dc.campaign_id", "d.campaign_id")
      .where("dc.college_id", req.user.college_id)
      .andWhere("d.payment_status", "SUCCESS")
      .groupBy("u.user_id")
      .select(
        "u.user_id",
        "u.username",
        "u.profile_image_url"
      )
      .sum({ total_donated: "d.amount" })
      .orderBy("total_donated", "desc");

    return res.json({
      success: true,
      data: leaderboard
    });

  } catch (err) {
    console.error("Leaderboard Error:", err);
    return res.status(500).json({ error: err.message });
  }
};

const getDonationHistory = async (req, res) => {
  try {

    if (req.user.role !== "ALUMNI") {
      return res.status(403).json({
        message: "Only Alumni can view donation history"
      });
    }

    const donations = await db("donations as d")
      .join("donation_campaigns as dc", "dc.campaign_id", "d.campaign_id")
      .where("d.alumni_user_id", req.user.user_id)
      .where("dc.college_id", req.user.college_id)
      .whereNull("dc.deleted_at")
      .select(
        "d.donation_id",
        "dc.title as campaign_title",
        "dc.campaign_type",
        "d.amount",
        "d.is_anonymous",
        "d.payment_status",
        "d.created_at"
      )
      .orderBy("d.created_at", "desc");

    return res.json({
      success: true,
      data: donations
    });

  } catch (err) {
    console.error("Donation History Error:", err);
    return res.status(500).json({ error: err.message });
  }
};

const closeCampaign = async (req, res) => {
  try {

    if (req.user.role !== "ANO") {
      return res.status(403).json({
        message: "Only ANO can close campaigns"
      });
    }

    const { campaign_id } = req.params;

    if (!campaign_id) {
      return res.status(400).json({
        message: "campaign_id is required"
      });
    }

    await db.transaction(async (trx) => {

      const campaign = await trx("donation_campaigns")
        .where({
          campaign_id,
          college_id: req.user.college_id
        })
        .whereNull("deleted_at")
        .forUpdate()
        .first();

      if (!campaign) {
        throw new Error("CAMPAIGN_NOT_FOUND");
      }

      if (campaign.campaign_type === "DEFAULT") {
        throw new Error("CANNOT_CLOSE_DEFAULT");
      }

      if (campaign.status === "CLOSED") {
        throw new Error("ALREADY_CLOSED");
      }

      await trx("donation_campaigns")
        .where({ campaign_id })
        .update({
          status: "CLOSED"
        });

    });

    return res.json({
      success: true,
      message: "Campaign closed successfully"
    });

  } catch (err) {

    if (err.message === "CAMPAIGN_NOT_FOUND") {
      return res.status(404).json({
        message: "Campaign not found"
      });
    }

    if (err.message === "CANNOT_CLOSE_DEFAULT") {
      return res.status(400).json({
        message: "Default campaign cannot be closed"
      });
    }

    if (err.message === "ALREADY_CLOSED") {
      return res.status(400).json({
        message: "Campaign is already closed"
      });
    }

    console.error("Close Campaign Error:", err);
    return res.status(500).json({
      error: "Internal server error"
    });
  }
};

module.exports = {
  createCampaign,
  getCampaigns,
  createOrder,
  verifyPayment,
  closeCampaign,
  getLeaderboard,
  getDonationHistory
};