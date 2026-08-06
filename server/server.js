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

const checkoutRoutes = require("./routes/checkout");
const webhookRoutes = require("./routes/webhook");
const sendOrderEmails = require("./services/email");

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


// ---------------------------------------------------------------------------
// Stripe webhook MUST be mounted before express.json().
// Stripe's signature verification needs the raw, unparsed request body.
// If express.json() runs first, it consumes the body stream and replaces
// req.body with a parsed object, and constructEvent() will fail signature
// verification on every webhook call.
// (The webhook route itself applies express.raw() only to its own path,
// so routes mounted after this are unaffected.)
// ---------------------------------------------------------------------------
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

app.g