require("dotenv").config({
    path: require("path").resolve(__dirname, ".env"),
});
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
console.log("STRIPE_SECRET_KEY:", !!process.env.STRIPE_SECRET_KEY);
console.log("STRIPE_WEBHOOK_SECRET:", !!process.env.STRIPE_WEBHOOK_SECRET);
console.log("RESEND_API_KEY:", !!process.env.RESEND_API_KEY);
console.log("1");
const checkoutRoutes = require("./routes/checkout");
console.log("2");
const webhookRoutes = require("./routes/webhook");
console.log("3");
const sendOrderEmails = require("./services/email");
console.log("4");
app.use(
    cors({
        origin: [
            "https://goodereseh.com",
            "https://www.goodereseh.com"
        ],
        methods: [
            "GET",
            "POST",
            "OPTIONS"
        ],
        allowedHeaders: [
            "Content-Type"
        ]
    })
);
app.use(
    webhookRoutes(
        stripe,
        sendOrderEmails
    )
);
app.use(express.json({
    limit: "100kb"
}));
app.use(checkoutRoutes(stripe));
app.get("/", (req, res) => {
    res.send("Good Ereseh Stripe Server is Running");
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Good Ereseh Stripe server running on port ${PORT}`);
});
