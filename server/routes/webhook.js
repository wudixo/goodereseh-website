const express = require("express");

const router = express.Router();

// ---------------------------------------------------------------------------
// Naive in-memory dedupe of processed Stripe event IDs.
// This works for a single server instance, but resets on restart and won't
// work across multiple instances/dynos. For production at any real scale,
// replace this with a persisted check (DB table / Redis set keyed on
// event.id) so retried webhooks can't cause duplicate order emails.
// ---------------------------------------------------------------------------
const processedEventIds = new Set();
const MAX_TRACKED_EVENTS = 5000; // basic cap so this doesn't grow forever

function markProcessed(eventId) {
    processedEventIds.add(eventId);
    if (processedEventIds.size > MAX_TRACKED_EVENTS) {
        const oldest = processedEventIds.values().next().value;
        processedEventIds.delete(oldest);
    }
}

function formatAddress(addressObj) {
    if (!addressObj) return "";
    const { line1, line2, city, postal_code, country } = addressObj;
    return [line1, line2, city, postal_code, country]
        .filter(Boolean)
        .join(", ");
}

module.exports = function (stripe, sendOrderEmails) {
    router.post(
        "/webhook",
        express.raw({ type: "application/json" }),
        async (req, res) => {
            const signature = req.headers["stripe-signature"];

            let event;

            try {
                event = stripe.webhooks.constructEvent(
                    req.body,
                    signature,
                    process.env.STRIPE_WEBHOOK_SECRET
                );
            } catch (error) {
                console.error("Webhook signature failed:", error.message);

                return res.status(400).send(`Webhook Error: ${error.message}`);
            }

            // Acknowledge duplicate deliveries without reprocessing them
            if (processedEventIds.has(event.id)) {
                console.log("Duplicate webhook event ignored:", event.id);
                return res.json({ received: true });
            }

            if (event.type === "checkout.session.completed") {
                try {
                    const session = event.data.object;

                    const metadata = session.metadata || {};
                    const customer = session.customer_details || {};
                    const shipping = session.shipping_details || {};

                    // metadata.address was stored as a JSON string by the
                    // checkout route (JSON.stringify(address)) — parse it
                    // back into an object rather than using it raw.
                    let metadataAddress = "";
                    if (metadata.address) {
                        try {
                            const parsed = JSON.parse(metadata.address);
                            metadataAddress = formatAddress(parsed) || String(metadata.address);
                        } catch {
                            // Wasn't JSON (e.g. an older order) — use as-is.
                            metadataAddress = metadata.address;
                        }
                    }

                    const order = {
                        artwork: metadata.artwork || "",
                        price: metadata.price || "",
                        type: metadata.type || "",
                        name: metadata.name || customer.name || "",
                        email: metadata.email || customer.email || "",
                        phone: metadata.phone || customer.phone || "",
                        address: metadataAddress || formatAddress(shipping.address),
                    };

                    // Log without sensitive PII (email/phone/address omitted)
                    console.log("Completed order:", {
                        artwork: order.artwork,
                        type: order.type,
                        price: order.price,
                    });

                    await sendOrderEmails(order);

                    console.log("Order emails sent for event:", event.id);
                } catch (error) {
                    console.error("Webhook processing error:", error);

                    // TODO: this order's confirmation email has failed silently.
                    // Consider writing failed orders somewhere durable (DB row,
                    // alerting channel, retry queue) so it isn't lost — Stripe
                    // won't retry once we respond 200 below.
                }
            }

            markProcessed(event.id);

            res.json({ received: true });
        }
    );

    return router;
};