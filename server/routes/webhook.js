const express = require("express");
const supabase = require("../supabase");

const router = express.Router();

const processedEventIds = new Set();
const MAX_TRACKED_EVENTS = 5000;


function markProcessed(eventId) {

    processedEventIds.add(eventId);

    if (processedEventIds.size > MAX_TRACKED_EVENTS) {

        const oldest =
            processedEventIds.values().next().value;

        processedEventIds.delete(oldest);

    }

}


function formatAddress(addressObj) {

    if (!addressObj) {
        return "";
    }

    const {
        line1,
        line2,
        city,
        postal_code,
        country
    } = addressObj;

    return [
        line1,
        line2,
        city,
        postal_code,
        country
    ]
        .filter(Boolean)
        .join(", ");

}


module.exports = function (
    stripe,
    sendOrderEmails
) {

    router.post(
        "/webhook",
        express.raw({
            type: "application/json"
        }),
        async (req, res) => {

            const signature =
                req.headers["stripe-signature"];

            let event;


            /*
            |--------------------------------------------------------------------------
            | VERIFY STRIPE SIGNATURE
            |--------------------------------------------------------------------------
            */

            try {

                event =
                    stripe.webhooks.constructEvent(
                        req.body,
                        signature,
                        process.env.STRIPE_WEBHOOK_SECRET
                    );

            }

            catch (error) {

                console.error(
                    "Webhook signature failed:",
                    error.message
                );

                return res
                    .status(400)
                    .send(
                        `Webhook Error: ${error.message}`
                    );

            }


            /*
            |--------------------------------------------------------------------------
            | IGNORE DUPLICATE EVENTS
            |--------------------------------------------------------------------------
            */

            if (
                processedEventIds.has(
                    event.id
                )
            ) {

                console.log(
                    "Duplicate webhook event ignored:",
                    event.id
                );

                return res.json({
                    received: true
                });

            }


            /*
            |--------------------------------------------------------------------------
            | CHECKOUT COMPLETED
            |--------------------------------------------------------------------------
            */

            if (
                event.type ===
                "checkout.session.completed"
            ) {

                try {

                    const session =
                        event.data.object;

                    const metadata =
                        session.metadata || {};

                    const customer =
                        session.customer_details || {};

                    const shipping =
                        session.shipping_details || {};

                    const productId =
                        metadata.productId || "";


                    /*
                    |--------------------------------------------------------------------------
                    | COMMISSION DEPOSIT
                    |--------------------------------------------------------------------------
                    */

                    if (
                        metadata.payment_type ===
                        "commission_deposit"
                    ) {

                        const commissionId =
                            metadata.commission_id || "";

                        if (!commissionId) {

                            console.error(
                                "Commission payment received without commission_id"
                            );

                            markProcessed(
                                event.id
                            );

                            return res.json({
                                received: true
                            });

                        }


                        const {
                            error:
                                commissionUpdateError
                        } =
                            await supabase
                                .from(
                                    "commissions"
                                )
                                .update({

                                    payment_status:
                                        "deposit_paid",

                                    commission_status:
                                        "confirmed",

                                    stripe_payment_intent_id:
                                        session.payment_intent ||
                                        null

                                })
                                .eq(
                                    "id",
                                    commissionId
                                );


                        if (
                            commissionUpdateError
                        ) {

                            console.error(
                                "Commission payment update error:",
                                commissionUpdateError
                            );

                        }

                        else {

                            console.log(
                                "Commission deposit marked as paid:",
                                metadata.commission_number
                            );

                        }


                        markProcessed(
                            event.id
                        );


                        return res.json({
                            received: true
                        });

                    }


                    /*
                    |--------------------------------------------------------------------------
                    | ORIGINAL ARTWORK INVENTORY
                    |--------------------------------------------------------------------------
                    */

                    if (
                        productId.endsWith(
                            "_original"
                        )
                    ) {

                        const {
                            error:
                                availabilityError
                        } =
                            await supabase
                                .from(
                                    "artworks"
                                )
                                .update({
                                    available:
                                        false
                                })
                                .eq(
                                    "id",
                                    productId
                                );


                        if (
                            availabilityError
                        ) {

                            console.error(
                                "Failed to mark artwork as sold:",
                                availabilityError
                            );

                        }

                        else {

                            console.log(
                                "Marked original as sold:",
                                productId
                            );

                        }

                    }


                    /*
                    |--------------------------------------------------------------------------
                    | SHIPPING ADDRESS
                    |--------------------------------------------------------------------------
                    */

                    let metadataAddress =
                        "";


                    if (
                        metadata.address
                    ) {

                        try {

                            const parsed =
                                JSON.parse(
                                    metadata.address
                                );

                            metadataAddress =
                                formatAddress(
                                    parsed
                                ) ||
                                String(
                                    metadata.address
                                );

                        }

                        catch {

                            metadataAddress =
                                metadata.address;

                        }

                    }


                    /*
                    |--------------------------------------------------------------------------
                    | BUILD ORDER OBJECT
                    |--------------------------------------------------------------------------
                    */

                    const order = {

                        artwork:
                            metadata.artwork ||
                            "",

                        price:
                            metadata.price ||
                            "",

                        type:
                            metadata.type ||
                            "",

                        image:
                            metadata.image ||
                            "",

                        name:
                            metadata.name ||
                            customer.name ||
                            "",

                        email:
                            metadata.email ||
                            customer.email ||
                            "",

                        phone:
                            metadata.phone ||
                            customer.phone ||
                            "",

                        address:
                            metadataAddress ||
                            formatAddress(
                                shipping.address
                            )

                    };


                    /*
                    |--------------------------------------------------------------------------
                    | STORE ORDER IN SUPABASE
                    |--------------------------------------------------------------------------
                    */

                    const {
                        error:
                            insertError
                    } =
                        await supabase
                            .from(
                                "orders"
                            )
                            .insert({

                                stripe_session_id:
                                    session.id,

                                stripe_event_id:
                                    event.id,

                                product_id:
                                    productId,

                                artwork:
                                    order.artwork,

                                type:
                                    order.type,

                                price:
                                    order.price,

                                customer_name:
                                    order.name,

                                customer_email:
                                    order.email,

                                customer_phone:
                                    order.phone,

                                customer_address:
                                    order.address,

                                payment_status:
                                    "paid"

                            });


                    if (
                        insertError
                    ) {

                        if (
                            insertError.code ===
                            "23505"
                        ) {

                            console.log(
                                "Order already stored for this event. Skipping duplicate email:",
                                event.id
                            );

                            markProcessed(
                                event.id
                            );

                            return res.json({
                                received:
                                    true
                            });

                        }


                        console.error(
                            "Failed to store order in Supabase:",
                            insertError
                        );

                    }

                    else {

                        console.log(
                            "Order stored in Supabase:",
                            event.id
                        );

                    }


                    /*
                    |--------------------------------------------------------------------------
                    | SEND ARTWORK ORDER EMAILS
                    |--------------------------------------------------------------------------
                    */

                    console.log(
                        "Completed order:",
                        {
                            artwork:
                                order.artwork,

                            type:
                                order.type,

                            price:
                                order.price
                        }
                    );


                    await sendOrderEmails(
                        order
                    );


                    console.log(
                        "Order emails sent for event:",
                        event.id
                    );

                }

                catch (error) {

                    console.error(
                        "Webhook processing error:",
                        error
                    );

                }

            }


            /*
            |--------------------------------------------------------------------------
            | MARK EVENT AS PROCESSED
            |--------------------------------------------------------------------------
            */

            markProcessed(
                event.id
            );


            res.json({
                received: true
            });

        }
    );


    return router;

};