const express = require("express");
const router = express.Router();

module.exports = function (stripe) {

    router.get("/order-details/:sessionId", async (req, res) => {
        const { sessionId } = req.params;

        try {
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            const metadata = session.metadata || {};

            res.json({
                artwork:   metadata.artwork   || "",
                type:      metadata.type      || "",
                price:     metadata.price     || "",
                image:     metadata.image     || "",
                reference: sessionId.slice(-12),
            });
        } catch (err) {
            console.error("Order details error:", err);
            res.status(500).json({ error: "Could not fetch order details." });
        }
    });

    return router;
};
