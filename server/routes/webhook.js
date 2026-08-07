const express = require("express");
const supabase = require("../supabase");

const router = express.Router();

const processedEventIds = new Set();
const MAX_TRACKED_EVENTS = 5000;

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
    return [line1, line2, city, postal_code, country].filter(Boolean).join(", ");
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
                    const productId = metadata.productId || "";

                    if (productId.endsWith("_original")) {
                        const { error: availError } = await supabase
                            .from("artworks")
                            .update({ available: false })
                            .eq("id", productId);

                        if (availError) {
                            console.error("Failed to mark artwork as sold:", availError);
                        } else {
                            console.log("Marked original as sold:", productId);
                        }
                    }

                    let metadataAddress = "";
                    if (metadata.address) {
                        try {
                            const parsed = JSON.parse(metadata.address);
                            metadataAddress = formatAddress(parsed) || String(metadata.address);
                        } catch {
                            metadataAddress = metadata.address;
                        }
                    }

                    const order = {
                        artwork: metadata.artwork || "",
                        price: metadata.price || "",
                        type: metadata.type || "",
                        image: metadata.image || "",
                        name: metadata.name || customer.name || "",
                        email: metadata.email || customer.email || "",
                        phone: metadata.phone || customer.phone || "",
                        address: metadataAddress || formatAddress(shipping.address),
                    };

                    const { error: insertError } = await supabase.from("orders").insert({
                        stripe_session_id: session.id,
                        stripe_event_id: event.id,
                        product_id: productId,
                        artwork: order.artwork,
                        type: order.type,
                        price: order.price,
                        customer_name: order.name,
                        customer_email: order.email,
                        customer_phone: order.phone,
                        customer_address: order.address,
                        payment_status: "paid",
                    });

                    if (insertError) {
                        if (insertError.code === "23505") {
                            console.log("Order already stored for this event — skipping email resend:", event.id);
                            markProcessed(event.id);
                            return res.json({ received: true });
                        }
                        console.error("Failed to store order in Supabase:", insertError);
                    } else {
                        console.log("Order stored in Supabase:", event.id);
                    }

                    console.log("Completed order:", {
                        artwork: order.artwork,
                        type: order.type,
                        price: order.price,
                    });

                    await sendOrderEmails(order);

                    console.log("Order emails sent for event:", event.id);
                } catch (error) {
                    console.error("Webhook processing error:", error);
                }
            }

            markProcessed(event.id);

            res.json({ received: true });
        }
    );

    return router;
};
