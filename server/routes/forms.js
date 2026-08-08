require("dotenv").config({
    path: require("path").resolve(__dirname, "../.env"),
});

const express = require("express");
const { Resend } = require("resend");
const Stripe = require("stripe");
const supabase = require("../supabase");

const router = express.Router();

const resend = new Resend(process.env.RESEND_API_KEY);
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const OWNER_EMAIL =
    process.env.OWNER_EMAIL || "goodereseh@gmail.com";


/*
|--------------------------------------------------------------------------
| CONTACT FORM
|--------------------------------------------------------------------------
*/

router.post("/contact", async (req, res) => {

    const {
        name,
        email,
        message
    } = req.body;


    if (!name || !email || !message) {

        return res.status(400).json({
            error: "Name, email and message are required."
        });

    }


    try {

        await resend.emails.send({

            from: "Good Ereseh Website <art@goodereseh.com>",

            to: OWNER_EMAIL,

            replyTo: email,

            subject:
                "New Contact Message | " + name,

            html: `
                <h2>New Website Message</h2>

                <p>
                    <strong>Name:</strong>
                    ${escapeHtml(name)}
                </p>

                <p>
                    <strong>Email:</strong>
                    ${escapeHtml(email)}
                </p>

                <p>
                    <strong>Message:</strong>
                </p>

                <p>
                    ${escapeHtml(message).replace(/\n/g, "<br>")}
                </p>
            `
        });


        res.json({
            success: true
        });

    }

    catch (error) {

        console.error(
            "Contact form error:",
            error
        );

        res.status(500).json({
            error:
                "Failed to send message."
        });

    }

});



/*
|--------------------------------------------------------------------------
| COMMISSION REQUEST
|--------------------------------------------------------------------------
*/

router.post("/commission", async (req, res) => {

    const {

        name,

        email,

        phone,

        "commission-type": type,

        size,

        message,

        imageB64,

        imageType,

        conceptUrl

    } = req.body;


    if (!name || !email) {

        return res.status(400).json({
            error:
                "Name and email are required."
        });

    }


    try {

        /*
        ---------------------------------------------------------------
        Create commission reference
        ---------------------------------------------------------------
        */

        const commissionNumber =
            "GE-" +
            new Date().getFullYear() +
            "-" +
            Math.random()
                .toString(36)
                .substring(2, 8)
                .toUpperCase();


        /*
        ---------------------------------------------------------------
        Save reference image to Supabase Storage
        ---------------------------------------------------------------
        */

        let referenceImagePath = null;


        if (imageB64) {

            try {

                const cleanBase64 =
                    imageB64.replace(
                        /^data:[^;]+;base64,/,
                        ""
                    );


                const buffer =
                    Buffer.from(
                        cleanBase64,
                        "base64"
                    );


                const extension =
                    getExtensionFromMimeType(
                        imageType
                    );


                referenceImagePath =
                    commissionNumber +
                    "/reference-" +
                    Date.now() +
                    "." +
                    extension;


                const {
                    error: uploadError
                } =
                    await supabase.storage
                        .from(
                            "commission-references"
                        )
                        .upload(
                            referenceImagePath,
                            buffer,
                            {
                                contentType:
                                    imageType ||
                                    "image/jpeg",

                                upsert:
                                    false
                            }
                        );


                if (uploadError) {

                    console.error(
                        "Reference image upload error:",
                        uploadError
                    );

                    referenceImagePath =
                        null;

                }

            }

            catch (imageError) {

                console.error(
                    "Reference image processing error:",
                    imageError
                );

            }

        }


        /*
        ---------------------------------------------------------------
        Save commission to database
        ---------------------------------------------------------------
        */

        const referenceImages =
            referenceImagePath
                ? [
                    {
                        path:
                            referenceImagePath
                    }
                ]
                : [];


        const {
            data: commission,
            error: commissionError
        } =
            await supabase
                .from("commissions")
                .insert({

                    commission_number:
                        commissionNumber,

                    customer_name:
                        name,

                    customer_email:
                        email,

                    customer_phone:
                        phone || "",

                    description:
                        message || "",

                    reference_images:
                        referenceImages,

                    generated_concept_image:
                        conceptUrl || null,

                    artwork_size:
                        size || "",

                    medium:
                        "Charcoal and Graphite",

                    payment_status:
                        "unpaid",

                    commission_status:
                        "requested"

                })
                .select()
                .single();


        if (
            commissionError ||
            !commission
        ) {

            console.error(
                "Supabase commission error:",
                commissionError
            );

            return res.status(500).json({
                error:
                    "Unable to save commission request."
            });

        }


        /*
        ---------------------------------------------------------------
        Build owner email
        ---------------------------------------------------------------
        */

        const ownerHtml = `
            <h2>New Commission Request</h2>

            <p>
                <strong>Commission:</strong>
                ${escapeHtml(commissionNumber)}
            </p>

            <h3>Customer Details</h3>

            <p>
                <strong>Name:</strong>
                ${escapeHtml(name)}
            </p>

            <p>
                <strong>Email:</strong>
                ${escapeHtml(email)}
            </p>

            <p>
                <strong>Phone:</strong>
                ${escapeHtml(phone || "")}
            </p>

            <h3>Commission Details</h3>

            <p>
                <strong>Type:</strong>
                ${escapeHtml(type || "AI Commission")}
            </p>

            <p>
                <strong>Size:</strong>
                ${escapeHtml(size || "Not selected")}
            </p>

            <p>
                <strong>Medium:</strong>
                Charcoal and Graphite
            </p>

            <p>
                <strong>Brief:</strong>
            </p>

            <p>
                ${escapeHtml(message || "").replace(/\n/g, "<br>")}
            </p>

            ${
                conceptUrl
                    ? `
                        <h3>AI Concept</h3>

                        <img
                            src="${escapeHtml(conceptUrl)}"
                            alt="Commission concept"
                            width="320"
                            style="
                                max-width:100%;
                                height:auto;
                                border-radius:8px;
                            "
                        >
                    `
                    : ""
            }

            ${
                referenceImagePath
                    ? `
                        <p>
                            <strong>
                                Reference image saved securely in Supabase.
                            </strong>
                        </p>
                    `
                    : ""
            }
        `;


        /*
        ---------------------------------------------------------------
        Send owner notification
        ---------------------------------------------------------------
        */

        await resend.emails.send({

            from:
                "Good Ereseh <art@goodereseh.com>",

            to:
                OWNER_EMAIL,

            replyTo:
                email,

            subject:
                "Commission Brief | " +
                commissionNumber +
                " | " +
                name,

            html:
                ownerHtml

        });


        /*
        ---------------------------------------------------------------
        Send customer confirmation
        ---------------------------------------------------------------
        */

        await resend.emails.send({

            from:
                "Good Ereseh <art@goodereseh.com>",

            to:
                email,

            subject:
                "Your Commission Request | " +
                commissionNumber,

            html: `
                <div
                    style="
                        max-width:620px;
                        margin:0 auto;
                        padding:32px;
                        font-family:Arial,sans-serif;
                        color:#1a1812;
                        line-height:1.7;
                    "
                >

                    <h2>
                        Thank you for your commission request
                    </h2>

                    <p>
                        Dear ${escapeHtml(name)},
                    </p>

                    <p>
                        Your commission brief has been received successfully.
                    </p>

                    <p>
                        <strong>
                            Commission reference:
                        </strong>

                        ${escapeHtml(commissionNumber)}
                    </p>

                    <p>
                        Good Ereseh will review your request and confirm the final quotation before the artwork begins.
                    </p>

                    <p>
                        You can secure your commission slot now with the £50 booking deposit.
                    </p>

                    <p>
                        The booking deposit will be accounted for when your final commission price is confirmed.
                    </p>

                    <p>
                        Good Ereseh
                        <br>
                        London, United Kingdom
                    </p>

                </div>
            `

        });


        /*
        ---------------------------------------------------------------
        Create Stripe booking deposit
        ---------------------------------------------------------------
        */

        const stripeSession =
            await stripe.checkout.sessions.create({

                mode:
                    "payment",

                customer_email:
                    email,

                billing_address_collection:
                    "required",

                phone_number_collection: {
                    enabled:
                        true
                },

                line_items: [

                    {

                        price_data: {

                            currency:
                                "gbp",

                            product_data: {

                                name:
                                    "Commission Booking Deposit",

                                description:
                                    "Commission " +
                                    commissionNumber

                            },

                            unit_amount:
                                5000

                        },

                        quantity:
                            1

                    }

                ],

                metadata: {

                    payment_type:
                        "commission_deposit",

                    commission_id:
                        String(
                            commission.id
                        ),

                    commission_number:
                        commissionNumber,

                    customer_name:
                        name,

                    customer_email:
                        email,

                    commission_type:
                        type || "",

                    artwork_size:
                        size || ""

                },

                success_url:
                    "https://goodereseh.com/success.html" +
                    "?type=commission" +
                    "&commission=" +
                    encodeURIComponent(
                        commissionNumber
                    ),

                cancel_url:
                    "https://goodereseh.com/commissions"

            });


        /*
        ---------------------------------------------------------------
        Store Stripe session ID
        ---------------------------------------------------------------
        */

        const {
            error: sessionUpdateError
        } =
            await supabase
                .from("commissions")
                .update({

                    stripe_session_id:
                        stripeSession.id

                })
                .eq(
                    "id",
                    commission.id
                );


        if (sessionUpdateError) {

            console.error(
                "Stripe session save error:",
                sessionUpdateError
            );

        }


        /*
        ---------------------------------------------------------------
        Return information to chatbot
        ---------------------------------------------------------------
        */

        res.json({

            success:
                true,

            commissionNumber:
                commissionNumber,

            paymentUrl:
                stripeSession.url

        });

    }

    catch (error) {

        console.error(
            "Commission route error:",
            error
        );


        res.status(500).json({

            error:
                "Failed to process commission request. Please email art@goodereseh.com directly."

        });

    }

});



/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function escapeHtml(value) {

    return String(
        value ?? ""
    ).replace(
        /[&<>"']/g,
        function (character) {

            switch (character) {

                case "&":
                    return "&amp;";

                case "<":
                    return "&lt;";

                case ">":
                    return "&gt;";

                case '"':
                    return "&quot;";

                case "'":
                    return "&#39;";

                default:
                    return character;

            }

        }
    );

}


function getExtensionFromMimeType(
    mimeType
) {

    switch (
        mimeType
    ) {

        case "image/png":
            return "png";

        case "image/webp":
            return "webp";

        case "image/gif":
            return "gif";

        default:
            return "jpg";

    }

}


module.exports = router;