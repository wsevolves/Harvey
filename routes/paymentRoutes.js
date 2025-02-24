
const express = require("express");
const stripe = require("../config/stripe");
const Donor = require("../models/donor");
const router = express.Router();

// Payment Route with Multiple Methods
router.post("/create-payment", async (req, res) => {
  try {
    console.log("🔹 Incoming Payment Request:", req.body);

    const {
      name,
      number,
      email,
      category,
      amount,
      paymentMethod,
      cardDetails,
      billingAddress,
    } = req.body;

    // Validate required fields
    if (!name || !number || !email || !category || !amount || !paymentMethod) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate payment method
    const validMethods = ["card", "klarna", "link", "cashapp", "amazon_pay"];
    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: "Invalid payment method" });
    }

    let paymentIntentData = {
      amount: amount * 100, // Convert to cents
      currency: "usd",
      receipt_email: email,
      payment_method_types: [paymentMethod],
      metadata: { name, number, category },
    };

    // Handle payment method details
    if (paymentMethod === "card") {
      if (!cardDetails || !cardDetails.cardToken) {
        return res
          .status(400)
          .json({ error: "Card token is required for card payments" });
      }

      // Create a PaymentMethod from the token
      const paymentMethodResponse = await stripe.paymentMethods.create({
        type: "card",
        card: { token: cardDetails.cardToken },
        billing_details: billingAddress || {},
      });

      // Attach the PaymentMethod to the PaymentIntent
      paymentIntentData.payment_method = paymentMethodResponse.id;
    }

    // Create Payment Intent
    console.log("🔹 Creating Stripe Payment Intent...");
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);
    console.log("✅ Payment Intent Created:", paymentIntent.id);

    // Confirm the Payment Intent
    console.log("🔹 Confirming Payment Intent...");
    const confirmedPaymentIntent = await stripe.paymentIntents.confirm(
      paymentIntent.id
    );
    console.log("✅ Payment Intent Status:", confirmedPaymentIntent.status);

    // Check if payment was successful
    if (confirmedPaymentIntent.status !== "succeeded") {
      return res
        .status(400)
        .json({ error: "Payment failed", details: confirmedPaymentIntent });
    }

    // Get receipt URL from the charge object
    const charge = await stripe.charges.retrieve(
      confirmedPaymentIntent.latest_charge
    );
    const receiptUrl = charge.receipt_url;

    // Save donor details in MongoDB
    const newDonor = new Donor({
      name,
      number,
      email,
      category,
      paymentMethod,
      paymentRefId: confirmedPaymentIntent.id,
      paymentDate: new Date(),
      status: "success",
    });

    await newDonor.save();
    console.log("✅ Donor Details Saved in Database");

    res.json({
      clientSecret: confirmedPaymentIntent.client_secret,
      message: "Payment successful",
      paymentIntent: confirmedPaymentIntent,
      receiptUrl: receiptUrl, // ✅ Added receipt URL
    });
  } catch (error) {
    console.error("❌ Error Processing Payment:", error);

    // Stripe-specific error handling
    if (error.type === "StripeCardError") {
      return res.status(400).json({ error: "Card was declined" });
    }
    if (error.type === "StripeInvalidRequestError") {
      return res.status(400).json({ error: "Invalid request to Stripe API" });
    }

    res.status(500).json({ error: "Payment failed", details: error.message });
  }
});

router.get("/get-donators", async (req, res) => {
  try {
    let { page = 1, limit = 10, email, name, category, status } = req.query;

    // Convert page & limit to numbers
    page = parseInt(page);
    limit = parseInt(limit);

    // Build search query
    let query = {};
    if (email) query.email = email;
    if (name) query.name = new RegExp(name, "i"); // Case-insensitive search
    if (category) query.category = category;
    if (status) query.status = status;

    // Fetch donors with pagination
    const donors = await Donor.find(query)
      .sort({ paymentDate: -1 }) // Newest first
      .skip((page - 1) * limit)
      .limit(limit);

    // Get total count
    const totalDonors = await Donor.countDocuments(query);

    res.json({
      success: true,
      total: totalDonors,
      page,
      limit,
      donors,
    });
  } catch (error) {
    console.error("❌ Error Fetching Donors:", error);
    res.status(500).json({ error: "Failed to fetch donors" });
  }
});

module.exports = router;
