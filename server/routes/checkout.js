const supabase = require("../supabase");
const express = require("express");

const router = express.Router();

module.exports = function (stripe) {
    router.post("/create-checkout-session", async (req, res) => {
        try {
            const { productId, name, email, phone, address } = req.body;

            const { data: product, error } = await supabase
                .from("artworks")
                .select("*")
                .eq("id", productId)
                .single();

            if (error || !product) {
                return res.status(400).json({ error: "Invalid artwork selected." });
            }

            if (!product.available) {
                return res.status(400).json({ error: "This artwork has already been sold." });
            }

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
                                name: product.artwork,
                                description: product.type,
                                images: [product.image],
                            },
                            unit_amount: product.price * 100,
                        },
                        quantity: 1,
                    },
                ],
                metadata: {
                    productId,
                    artwork: product.artwork,
                    type: product.type,
                    price: String(product.price),
                    image: product.image,
                    name,
                    email,
                    phone,
                    address: String(address || ""),
                },
                success_url: "https://goodereseh.com/success.html",
                cancel_url: "https://goodereseh.com/cancel.html",
            });

            res.json({ url: session.url });
        } catch (error) {
            console.error("Checkout error:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
