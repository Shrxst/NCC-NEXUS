// backend/src/services/payment.service.js

const crypto = require("crypto");

const createPaymentOrder = async ({ amount, campaign_id, user_id }) => {

  // Generate fake order ID
  const fakeOrderId = "order_" + crypto.randomBytes(8).toString("hex");

  return {
    order_id: fakeOrderId,
    amount,
    currency: "INR",
    status: "created"
  };
};


const verifyPayment = async ({ order_id }) => {

  // In simulation, we auto-success
  return {
    success: true,
    payment_id: "pay_" + crypto.randomBytes(8).toString("hex"),
    signature: "simulated_signature"
  };
};

module.exports = {
  createPaymentOrder,
  verifyPayment
};