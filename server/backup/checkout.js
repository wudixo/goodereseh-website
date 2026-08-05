
const express = require("express");

const router = express.Router();

const ARTWORK_CATALOG = {
    // "artwork-id-or-name": priceInPence,
    // "sunset-over-hills": 4500,
    // "quiet-harbour": 3200,
};

module.exports = function (stripe) {
    router.post("/create-checkout-session", async (req, res) => {
        try {
            const { artwork, type, name, email, phone, address } = req.body;

            if (!artwork || typeof artwork !== "string") {
                return res.status(400).json({ error: "Missing or invalid artwork." });
            }
            if (!email || typeof email !== "string") {
                return res.status(400).json({ error: "Missing or invalid email." });
            }

            const unitAmount = ARTWORK_CATALOG[artwork];
            if (!unitAmount || !Number.isFinite(unitAmount) || unitAmount <= 0) {
                return res.status(400).json({ error: "Invalid or unrecognized artwork selected." });
            }

            console.log("Order received:", { artwork, type, name });

            const session = await stripe.checkout.sessions.create({
                mode: "payment",
                customer_email: email,
                billing_address_collection: "required",
                phone_number_collection: {
                    enabled: true,
                },
                line_items: [
                    {
                        price_data: {
                            currency: "gbp",
                            product_data: {
                                name: artwork,
                                description: `${type} by Good Ereseh`,
                            },
                            unit_amount: unitAmount,
                        },
                        quantity: 1,
                    },
                ],
                metadata: {
                    artwork: String(artwork || ""),
                    price: String(unitAmount / 100),
                    type: String(type || ""),
                    name: String(name || ""),
                    email: String(email || ""),
                    phone: String(phone || ""),
                    address: typeof address === "object" && address !== null
                        ? JSON.stringify(address)
                        : String(address || ""),
                },
                success_url: "https://goodereseh.com/success.html",
                cancel_url: "https://goodereseh.com/cancel.html",
            });

            console.log("Stripe session created:", session.id);

            res.json({ url: session.url });
        } catch (error) {
            console.error("Checkout error:", error);
            res.status(500).json({
                error: error.message,
            });
        }
    });

    return router;
};