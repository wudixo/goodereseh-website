require("dotenv").config({
    path: require("path").resolve(__dirname, "../.env"),
});

const express = require("express");
const { Resend } = require("resend");
const supabase = require("../supabase");

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

const OWNER_EMAIL =
    process.env.OWNER_EMAIL || "goodereseh@gmail.com";

const STORAGE_BUCKET = "commission-references";
const MAX_REFERENCES = 6;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
]);


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
    } = req.body || {};


    if (!name || !email || !message) {

        return res.status(400).json({
            error: "Name, email and message are required."
        });

    }


    try {

        await resend.emails.send({

            from:
                "Good Ereseh Website <art@goodereseh.com>",

            to:
                OWNER_EMAIL,

            replyTo:
                email,

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


        return res.json({
            success: true
        });

    }

    catch (error) {

        console.error(
            "Contact form error:",
            error
        );


        return res.status(500).json({
            error: "Failed to send message."
        });

    }

});



/*
|--------------------------------------------------------------------------
| COMMISSION REQUEST
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| This submits the commission for review.
|
| It does NOT:
|
| - charge the customer
| - create a Stripe session
| - generate an AI artwork
|
|--------------------------------------------------------------------------
*/

router.post("/commission", async (req, res) => {

    const body = req.body || {};


    /*
    |--------------------------------------------------------------------------
    | CUSTOMER
    |--------------------------------------------------------------------------
    */

    const name =
        clean(body.name);

    const email =
        clean(body.email);

    const phone =
        clean(body.phone);


    /*
    |--------------------------------------------------------------------------
    | COMMISSION
    |--------------------------------------------------------------------------
    */

    const type =
        clean(
            body["commission-type"] ||
            body.commissionType ||
            body.type
        );


    const size =
        clean(body.size);


    const framing =
        clean(body.framing);


    const deadline =
        clean(
            body.deadline ||
            body.requiredBy ||
            body.required_by
        );


    const serviceLevel =
        normaliseServiceLevel(
            body.serviceLevel ||
            body.service_level ||
            body.priority
        );


    const message =
        clean(
            body.message ||
            body.brief ||
            body.description
        );


    /*
    |--------------------------------------------------------------------------
    | AI CONVERSATION
    |--------------------------------------------------------------------------
    */

    const conversation =
        normaliseConversation(
            body.conversation ||
            body.messages ||
            body.chatHistory
        );


    /*
    |--------------------------------------------------------------------------
    | ADDRESS
    |--------------------------------------------------------------------------
    */

    const address =
        normaliseAddress(body);


    /*
    |--------------------------------------------------------------------------
    | REFERENCE CONSENT
    |--------------------------------------------------------------------------
    */

    const consent =
        toBoolean(

            body.referenceConsent ??

            body.reference_consent ??

            body.photoConsent ??

            body.photo_consent ??

            body.consent

        );


    /*
    |--------------------------------------------------------------------------
    | REFERENCE PHOTOS
    |--------------------------------------------------------------------------
    */

    let references =
        normaliseReferences(

            body.references ||

            body.referenceImages ||

            body.reference_images

        );


    /*
    |--------------------------------------------------------------------------
    | SUPPORT OLD SINGLE IMAGE FORMAT
    |--------------------------------------------------------------------------
    */

    if (
        !references.length &&
        body.imageB64
    ) {

        references = [

            {

                data:
                    body.imageB64,

                mimeType:
                    body.imageType ||
                    "image/jpeg",

                name:
                    "Reference 1"

            }

        ];

    }



    /*
    |--------------------------------------------------------------------------
    | VALIDATION
    |--------------------------------------------------------------------------
    */

    if (
        !name ||
        !email ||
        !phone
    ) {

        return res.status(400).json({

            error:
                "Name, email and phone number are required."

        });

    }


    if (!isValidEmail(email)) {

        return res.status(400).json({

            error:
                "Please enter a valid email address."

        });

    }


    if (
        !address.line1 ||
        !address.city ||
        !address.postcode ||
        !address.country
    ) {

        return res.status(400).json({

            error:
                "Address line 1, city, postcode and country are required."

        });

    }


    if (
        references.length >
        MAX_REFERENCES
    ) {

        return res.status(400).json({

            error:
                `You can upload a maximum of ${MAX_REFERENCES} reference images.`

        });

    }


    if (
        references.length &&
        !consent
    ) {

        return res.status(400).json({

            error:
                "Please confirm that you have permission to provide and use the reference photographs."

        });

    }



    /*
    |--------------------------------------------------------------------------
    | CREATE COMMISSION NUMBER
    |--------------------------------------------------------------------------
    */

    const commissionNumber =
        createCommissionNumber();


    const uploadedReferences = [];



    try {


        /*
        |--------------------------------------------------------------------------
        | UPLOAD REFERENCE PHOTOS
        |--------------------------------------------------------------------------
        */

        for (
            let index = 0;
            index < references.length;
            index++
        ) {

            const reference =
                references[index];


            const uploaded =
                await uploadReferenceImage(

                    commissionNumber,

                    reference,

                    index

                );


            uploadedReferences.push(
                uploaded
            );

        }



        /*
        |--------------------------------------------------------------------------
        | BASIC DATABASE RECORD
        |--------------------------------------------------------------------------
        */

        const baseRecord = {

            commission_number:
                commissionNumber,

            customer_name:
                name,

            customer_email:
                email,

            customer_phone:
                phone,

            description:
                message,

            reference_images:
                uploadedReferences,

            generated_concept_image:
                null,

            artwork_size:
                size,

            medium:
                "Charcoal and Graphite",

            payment_status:
                "unpaid",

            commission_status:
                "requested"

        };



        /*
        |--------------------------------------------------------------------------
        | COMPLETE DATABASE RECORD
        |--------------------------------------------------------------------------
        */

        const expandedRecord = {

            ...baseRecord,


            customer_address:
                address,


            framing:
                framing || null,


            requested_deadline:
                deadline || null,


            service_level:
                serviceLevel,


            reference_consent:
                consent,


            conversation:
                conversation,


            commission_brief:
                buildBrief({

                    type,

                    size,

                    framing,

                    deadline,

                    serviceLevel,

                    message,

                    references:
                        uploadedReferences,

                    conversation

                })

        };



        /*
        |--------------------------------------------------------------------------
        | SAVE COMMISSION TO SUPABASE
        |--------------------------------------------------------------------------
        */

        let commissionResult =
            await supabase

                .from("commissions")

                .insert(
                    expandedRecord
                )

                .select()

                .single();



        /*
        |--------------------------------------------------------------------------
        | FALLBACK FOR OLD DATABASE SCHEMA
        |--------------------------------------------------------------------------
        */

        if (

            commissionResult.error &&

            isMissingColumnError(
                commissionResult.error
            )

        ) {

            console.warn(

                "Commission table needs new columns. Saving compatible record:",

                commissionResult.error.message

            );


            commissionResult =
                await supabase

                    .from("commissions")

                    .insert(
                        baseRecord
                    )

                    .select()

                    .single();

        }



        /*
        |--------------------------------------------------------------------------
        | DATABASE FAILURE
        |--------------------------------------------------------------------------
        */

        if (

            commissionResult.error ||

            !commissionResult.data

        ) {

            console.error(

                "Supabase commission error:",

                commissionResult.error

            );


            await cleanupUploadedReferences(
                uploadedReferences
            );


            return res.status(500).json({

                error:
                    "Unable to save commission request."

            });

        }



        /*
        |--------------------------------------------------------------------------
        | EMAIL GOOD ERESEH
        |--------------------------------------------------------------------------
        */

        const ownerHtml =
            buildOwnerEmail({

                commissionNumber,

                name,

                email,

                phone,

                type,

                size,

                framing,

                deadline,

                serviceLevel,

                message,

                address,

                consent,

                references:
                    uploadedReferences,

                conversation

            });



        const ownerEmailResult =
            await resend.emails.send({

                from:
                    "Good Ereseh <art@goodereseh.com>",

                to:
                    OWNER_EMAIL,

                replyTo:
                    email,

                subject:

                    "New Commission | " +

                    commissionNumber +

                    " | " +

                    name,

                html:
                    ownerHtml

            });



        if (ownerEmailResult.error) {

            console.error(

                "Owner commission email error:",

                ownerEmailResult.error

            );

        }



        /*
        |--------------------------------------------------------------------------
        | CUSTOMER CONFIRMATION EMAIL
        |--------------------------------------------------------------------------
        */

        const customerEmailResult =
            await resend.emails.send({

                from:
                    "Good Ereseh <art@goodereseh.com>",

                to:
                    email,

                subject:

                    "Your Commission Request | " +

                    commissionNumber,

                html:
                    buildCustomerEmail({

                        commissionNumber,

                        name,

                        type,

                        size,

                        deadline,

                        serviceLevel

                    })

            });



        if (customerEmailResult.error) {

            console.error(

                "Customer commission email error:",

                customerEmailResult.error

            );

        }



        /*
        |--------------------------------------------------------------------------
        | SUCCESS
        |--------------------------------------------------------------------------
        |
        | No Stripe payment is created here.
        |--------------------------------------------------------------------------
        */

        return res.status(201).json({

            success:
                true,


            commissionNumber:
                commissionNumber,


            status:
                "requested",


            message:
                "Your commission request has been received. Good Ereseh will review your brief before a concept, quotation or payment link is issued."

        });

    }


    catch (error) {

        console.error(

            "Commission route error:",

            error

        );


        await cleanupUploadedReferences(
            uploadedReferences
        );


        return res.status(500).json({

            error:
                "Failed to process commission request. Please email art@goodereseh.com directly."

        });

    }

});



/*
|--------------------------------------------------------------------------
| UPLOAD REFERENCE IMAGE
|--------------------------------------------------------------------------
*/

async function uploadReferenceImage(

    commissionNumber,

    reference,

    index

) {


    const mimeType =

        clean(
            reference.mimeType ||
            reference.type
        ) ||

        getMimeTypeFromDataUrl(
            reference.data
        );



    /*
    |--------------------------------------------------------------------------
    | VALIDATE FILE TYPE
    |--------------------------------------------------------------------------
    */

    if (
        !ALLOWED_IMAGE_TYPES.has(
            mimeType
        )
    ) {

        throw new Error(

            "Reference images must be JPEG, PNG or WebP."

        );

    }



    /*
    |--------------------------------------------------------------------------
    | CLEAN BASE64
    |--------------------------------------------------------------------------
    */

    const cleanBase64 =
        stripDataUrl(
            reference.data
        );


    if (!cleanBase64) {

        throw new Error(

            `Reference ${index + 1} does not contain image data.`

        );

    }



    /*
    |--------------------------------------------------------------------------
    | CREATE BUFFER
    |--------------------------------------------------------------------------
    */

    let buffer;


    try {

        buffer =
            Buffer.from(
                cleanBase64,
                "base64"
            );

    }

    catch {

        throw new Error(

            `Reference ${index + 1} could not be read.`

        );

    }



    if (!buffer.length) {

        throw new Error(

            `Reference ${index + 1} is empty.`

        );

    }



    /*
    |--------------------------------------------------------------------------
    | MAXIMUM FILE SIZE
    |--------------------------------------------------------------------------
    */

    if (
        buffer.length >
        MAX_IMAGE_BYTES
    ) {

        throw new Error(

            `Reference ${index + 1} is too large. Maximum size is 4 MB.`

        );

    }



    /*
    |--------------------------------------------------------------------------
    | FILE EXTENSION
    |--------------------------------------------------------------------------
    */

    const extension =
        getExtensionFromMimeType(
            mimeType
        );



    /*
    |--------------------------------------------------------------------------
    | STORAGE PATH
    |--------------------------------------------------------------------------
    */

    const path =

        commissionNumber +

        "/reference-" +

        String(index + 1)
            .padStart(2, "0") +

        "-" +

        Date.now() +

        "." +

        extension;



    /*
    |--------------------------------------------------------------------------
    | UPLOAD TO SUPABASE STORAGE
    |--------------------------------------------------------------------------
    */

    const {
        error: uploadError
    } =

        await supabase.storage

            .from(
                STORAGE_BUCKET
            )

            .upload(

                path,

                buffer,

                {

                    contentType:
                        mimeType,

                    upsert:
                        false

                }

            );



    if (uploadError) {

        console.error(

            "Reference image upload error:",

            uploadError

        );


        throw new Error(

            `Reference ${index + 1} could not be uploaded.`

        );

    }



    /*
    |--------------------------------------------------------------------------
    | RETURN STORAGE INFORMATION
    |--------------------------------------------------------------------------
    */

    return {

        label:

            clean(
                reference.label ||
                reference.name
            ) ||

            `Reference ${index + 1}`,


        path:
            path,


        mime_type:
            mimeType,


        original_name:

            clean(
                reference.fileName ||
                reference.filename
            ) ||

            null

    };

}



/*
|--------------------------------------------------------------------------
| CLEAN UP UPLOADED IMAGES
|--------------------------------------------------------------------------
|
| If the database submission fails, remove the images that were already
| uploaded so we do not leave unused customer photographs in storage.
|--------------------------------------------------------------------------
*/

async function cleanupUploadedReferences(
    references
) {


    const paths =
        references

            .map(
                reference =>
                    reference.path
            )

            .filter(Boolean);



    if (!paths.length) {

        return;

    }



    try {

        const {
            error
        } =

            await supabase.storage

                .from(
                    STORAGE_BUCKET
                )

                .remove(
                    paths
                );


        if (error) {

            console.error(

                "Reference cleanup error:",

                error

            );

        }

    }


    catch (error) {

        console.error(

            "Reference cleanup exception:",

            error

        );

    }

}



/*
|--------------------------------------------------------------------------
| EMAIL TO GOOD ERESEH
|--------------------------------------------------------------------------
*/

function buildOwnerEmail(data) {


    const referenceList =

        data.references.length

            ?

            data.references

                .map(

                    (
                        reference,
                        index
                    ) => `

                        <li>

                            ${escapeHtml(

                                reference.label ||

                                `Reference ${index + 1}`

                            )}

                            <br>

                            <small>

                                Secure storage path:

                                ${escapeHtml(
                                    reference.path
                                )}

                            </small>

                        </li>

                    `

                )

                .join("")


            :

            "<li>No reference photographs supplied</li>";



    const conversationHtml =

        data.conversation.length

            ?

            data.conversation

                .map(

                    item => `

                        <p>

                            <strong>

                                ${escapeHtml(

                                    item.role === "assistant"

                                        ? "Studio AI"

                                        : "Customer"

                                )}:

                            </strong>

                            <br>

                            ${escapeHtml(
                                item.text
                            ).replace(
                                /\n/g,
                                "<br>"
                            )}

                        </p>

                    `

                )

                .join("")


            :

            "<p>No conversation transcript supplied.</p>";



    return `

        <div

            style="
                font-family:Arial,sans-serif;
                line-height:1.6;
                color:#1a1812;
                max-width:760px;
            "

        >


            <h2>
                New Commission Request
            </h2>


            <p>

                <strong>
                    Commission:
                </strong>

                ${escapeHtml(
                    data.commissionNumber
                )}

            </p>



            <h3>
                Customer
            </h3>


            <p>

                <strong>Name:</strong>
                ${escapeHtml(data.name)}

                <br>

                <strong>Email:</strong>
                ${escapeHtml(data.email)}

                <br>

                <strong>Phone:</strong>
                ${escapeHtml(data.phone)}

            </p>



            <h3>
                Delivery Address
            </h3>


            <p>

                ${formatAddressHtml(
                    data.address
                )}

            </p>



            <h3>
                Commission
            </h3>


            <p>

                <strong>Type:</strong>

                ${escapeHtml(
                    data.type ||
                    "Not specified"
                )}

                <br>


                <strong>Size:</strong>

                ${escapeHtml(
                    data.size ||
                    "Not selected"
                )}

                <br>


                <strong>Medium:</strong>

                Charcoal and Graphite

                <br>


                <strong>Framing:</strong>

                ${escapeHtml(
                    data.framing ||
                    "Not specified"
                )}

                <br>


                <strong>Requested date:</strong>

                ${escapeHtml(
                    data.deadline ||
                    "Not specified"
                )}

                <br>


                <strong>Service:</strong>

                ${escapeHtml(
                    data.serviceLevel
                )}

                <br>


                <strong>
                    Photo permission confirmed:
                </strong>

                ${
                    data.consent

                        ? "Yes"

                        : "Not applicable / No references"
                }

            </p>



            <h3>
                Customer Brief
            </h3>


            <p>

                ${escapeHtml(

                    data.message ||

                    "No separate written brief supplied."

                ).replace(
                    /\n/g,
                    "<br>"
                )}

            </p>



            <h3>
                Reference Photographs
            </h3>


            <ol>

                ${referenceList}

            </ol>



            <h3>
                AI Studio Conversation
            </h3>


            ${conversationHtml}



            <hr>



            <p>

                <strong>
                    Next step:
                </strong>

                Review the brief and references.

                No payment has been requested.

                Prepare or approve a concept,
                confirm the quotation and deadline,
                then issue the customer a private
                payment link.

            </p>


        </div>

    `;

}



/*
|--------------------------------------------------------------------------
| CUSTOMER CONFIRMATION EMAIL
|--------------------------------------------------------------------------
*/

function buildCustomerEmail(data) {


    return `

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
                Your commission request has been received
            </h2>


            <p>

                Dear ${escapeHtml(data.name)},

            </p>



            <p>

                Thank you for sharing your idea with the
                Good Ereseh Studio.

                Your commission request has been received
                for review.

            </p>



            <p>

                <strong>
                    Commission reference:
                </strong>

                ${escapeHtml(
                    data.commissionNumber
                )}

            </p>



            <p>

                <strong>
                    Commission type:
                </strong>

                ${escapeHtml(
                    data.type ||
                    "Not specified"
                )}

                <br>


                <strong>
                    Requested size:
                </strong>

                ${escapeHtml(
                    data.size ||
                    "Not selected"
                )}

                <br>


                <strong>
                    Requested completion date:
                </strong>

                ${escapeHtml(
                    data.deadline ||
                    "Not specified"
                )}

                <br>


                <strong>
                    Service request:
                </strong>

                ${escapeHtml(
                    data.serviceLevel
                )}

            </p>



            <p>

                Good Ereseh will review your brief
                and reference photographs.

                If a visual concept is needed,
                it will be prepared for your review.

            </p>



            <p>

                Once the concept, price and expected
                completion date are agreed, you will
                receive a private payment link.

            </p>



            ${

                data.serviceLevel === "Priority" ||

                data.serviceLevel === "Express"

                    ? `

                        <p>

                            Your request includes

                            ${escapeHtml(
                                data.serviceLevel
                            )}

                            service.

                            Availability and any priority
                            charge will be confirmed before
                            payment.

                        </p>

                    `

                    : ""

            }



            <p>

                Please keep your commission reference
                for future correspondence.

            </p>



            <p>

                Good Ereseh

                <br>

                London, United Kingdom

                <br>

                art@goodereseh.com

            </p>


        </div>

    `;

}



/*
|--------------------------------------------------------------------------
| BUILD COMMISSION BRIEF
|--------------------------------------------------------------------------
*/

function buildBrief(data) {


    return {

        commission_type:
            data.type || null,


        artwork_size:
            data.size || null,


        medium:
            "Charcoal and Graphite",


        framing:
            data.framing || null,


        requested_deadline:
            data.deadline || null,


        service_level:
            data.serviceLevel,


        customer_description:
            data.message || null,


        references:
            data.references,


        conversation:
            data.conversation

    };

}



/*
|--------------------------------------------------------------------------
| NORMALISE REFERENCE PHOTOS
|--------------------------------------------------------------------------
*/

function normaliseReferences(value) {


    if (!value) {

        return [];

    }


    let references =
        value;



    /*
    |--------------------------------------------------------------------------
    | JSON STRING
    |--------------------------------------------------------------------------
    */

    if (
        typeof references ===
        "string"
    ) {


        try {

            references =
                JSON.parse(
                    references
                );

        }


        catch {

            references = [

                {

                    data:
                        references,

                    mimeType:
                        getMimeTypeFromDataUrl(
                            references
                        )

                }

            ];

        }

    }



    if (
        !Array.isArray(
            references
        )
    ) {

        references = [
            references
        ];

    }



    return references

        .filter(Boolean)

        .map(

            (
                reference,
                index
            ) => {


                /*
                |--------------------------------------------------------------------------
                | SIMPLE STRING
                |--------------------------------------------------------------------------
                */

                if (
                    typeof reference ===
                    "string"
                ) {

                    return {

                        data:
                            reference,


                        mimeType:
                            getMimeTypeFromDataUrl(
                                reference
                            ),


                        label:
                            `Reference ${index + 1}`

                    };

                }



                /*
                |--------------------------------------------------------------------------
                | OBJECT
                |--------------------------------------------------------------------------
                */

                return {

                    data:

                        reference.data ||

                        reference.base64 ||

                        reference.imageB64 ||

                        reference.src ||

                        "",


                    mimeType:

                        reference.mimeType ||

                        reference.media_type ||

                        reference.imageType ||

                        reference.type ||

                        getMimeTypeFromDataUrl(

                            reference.data ||

                            reference.base64 ||

                            reference.imageB64 ||

                            reference.src ||

                            ""

                        ),


                    label:

                        reference.label ||

                        reference.name ||

                        `Reference ${index + 1}`,


                    fileName:

                        reference.fileName ||

                        reference.filename ||

                        ""

                };

            }

        )

        .filter(

            reference =>
                reference.data

        );

}



/*
|--------------------------------------------------------------------------
| NORMALISE AI CONVERSATION
|--------------------------------------------------------------------------
*/

function normaliseConversation(value) {


    if (!value) {

        return [];

    }


    let conversation =
        value;



    /*
    |--------------------------------------------------------------------------
    | JSON STRING
    |--------------------------------------------------------------------------
    */

    if (
        typeof conversation ===
        "string"
    ) {


        try {

            conversation =
                JSON.parse(
                    conversation
                );

        }


        catch {

            return [

                {

                    role:
                        "user",

                    text:
                        conversation

                }

            ];

        }

    }



    if (
        !Array.isArray(
            conversation
        )
    ) {

        return [];

    }



    return conversation

        .map(

            item => {


                /*
                |--------------------------------------------------------------------------
                | SIMPLE STRING
                |--------------------------------------------------------------------------
                */

                if (
                    typeof item ===
                    "string"
                ) {

                    return {

                        role:
                            "user",

                        text:
                            item

                    };

                }



                /*
                |--------------------------------------------------------------------------
                | ROLE
                |--------------------------------------------------------------------------
                */

                const role =

                    item.role ===
                    "assistant" ||

                    item.role ===
                    "model"

                        ? "assistant"

                        : "user";



                let text = "";



                /*
                |--------------------------------------------------------------------------
                | STRING CONTENT
                |--------------------------------------------------------------------------
                */

                if (
                    typeof item.content ===
                    "string"
                ) {

                    text =
                        item.content;

                }


                /*
                |--------------------------------------------------------------------------
                | TEXT PROPERTY
                |--------------------------------------------------------------------------
                */

                else if (
                    typeof item.text ===
                    "string"
                ) {

                    text =
                        item.text;

                }


                /*
                |--------------------------------------------------------------------------
                | MULTIMODAL CONTENT
                |--------------------------------------------------------------------------
                */

                else if (
                    Array.isArray(
                        item.content
                    )
                ) {

                    text =
                        item.content

                            .filter(

                                part =>

                                    part &&

                                    part.type ===
                                    "text" &&

                                    part.text

                            )

                            .map(

                                part =>
                                    part.text

                            )

                            .join("\n");

                }



                return {

                    role:
                        role,

                    text:
                        clean(text)

                };

            }

        )

        .filter(

            item =>
                item.text

        )

        .slice(-100);

}



/*
|--------------------------------------------------------------------------
| NORMALISE ADDRESS
|--------------------------------------------------------------------------
*/

function normaliseAddress(body) {


    const source =

        body.address &&

        typeof body.address ===
        "object"

            ? body.address

            : {};



    return {


        line1:

            clean(

                source.line1 ||

                body.addressLine1 ||

                body.address_line1

            ),



        line2:

            clean(

                source.line2 ||

                body.addressLine2 ||

                body.address_line2

            ),



        city:

            clean(

                source.city ||

                body.city

            ),



        county:

            clean(

                source.county ||

                source.region ||

                body.county ||

                body.region

            ),



        postcode:

            clean(

                source.postcode ||

                source.postal_code ||

                body.postcode ||

                body.postalCode ||

                body.postal_code

            ),



        country:

            clean(

                source.country ||

                body.country

            )

    };

}



/*
|--------------------------------------------------------------------------
| SERVICE LEVEL
|--------------------------------------------------------------------------
*/

function normaliseServiceLevel(value) {


    const service =
        clean(value)
            .toLowerCase();


    if (
        service ===
        "priority"
    ) {

        return "Priority";

    }


    if (
        service ===
        "express"
    ) {

        return "Express";

    }


    return "Standard";

}



/*
|--------------------------------------------------------------------------
| CREATE COMMISSION NUMBER
|--------------------------------------------------------------------------
*/

function createCommissionNumber() {


    const random =

        Math.random()

            .toString(36)

            .substring(
                2,
                8
            )

            .toUpperCase();



    return (

        "GE-" +

        new Date()
            .getFullYear() +

        "-" +

        random

    );

}



/*
|--------------------------------------------------------------------------
| CLEAN STRING
|--------------------------------------------------------------------------
*/

function clean(value) {

    return String(
        value ?? ""
    ).trim();

}



/*
|--------------------------------------------------------------------------
| BOOLEAN
|--------------------------------------------------------------------------
*/

function toBoolean(value) {


    if (
        value === true ||
        value === 1
    ) {

        return true;

    }


    const normalised =

        clean(value)
            .toLowerCase();


    return [

        "true",

        "1",

        "yes",

        "on",

        "confirmed"

    ].includes(
        normalised
    );

}



/*
|--------------------------------------------------------------------------
| EMAIL VALIDATION
|--------------------------------------------------------------------------
*/

function isValidEmail(value) {


    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(value);

}



/*
|--------------------------------------------------------------------------
| REMOVE DATA URL PREFIX
|--------------------------------------------------------------------------
*/

function stripDataUrl(value) {


    return clean(value).replace(

        /^data:[^;]+;base64,/,

        ""

    );

}



/*
|--------------------------------------------------------------------------
| GET MIME TYPE FROM DATA URL
|--------------------------------------------------------------------------
*/

function getMimeTypeFromDataUrl(value) {


    const match =

        clean(value).match(

            /^data:([^;]+);base64,/

        );


    return match

        ? match[1]
            .toLowerCase()

        : "image/jpeg";

}



/*
|--------------------------------------------------------------------------
| FILE EXTENSION
|--------------------------------------------------------------------------
*/

function getExtensionFromMimeType(
    mimeType
) {


    switch (mimeType) {


        case "image/png":

            return "png";


        case "image/webp":

            return "webp";


        default:

            return "jpg";

    }

}



/*
|--------------------------------------------------------------------------
| ESCAPE HTML
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



/*
|--------------------------------------------------------------------------
| FORMAT ADDRESS FOR EMAIL
|--------------------------------------------------------------------------
*/

function formatAddressHtml(address) {


    return [

        address.line1,

        address.line2,

        address.city,

        address.county,

        address.postcode,

        address.country

    ]

        .filter(Boolean)

        .map(
            escapeHtml
        )

        .join("<br>");

}



/*
|--------------------------------------------------------------------------
| DETECT OLD SUPABASE SCHEMA
|--------------------------------------------------------------------------
*/

function isMissingColumnError(error) {


    if (!error) {

        return false;

    }


    const text =

        [

            error.code,

            error.message,

            error.details,

            error.hint

        ]

            .filter(Boolean)

            .join(" ")

            .toLowerCase();



    return (

        text.includes(
            "column"
        )

        &&

        (

            text.includes(
                "does not exist"
            )

            ||

            text.includes(
                "schema cache"
            )

            ||

            text.includes(
                "could not find"
            )

        )

    );

}



/*
|--------------------------------------------------------------------------
| EXPORT ROUTER
|--------------------------------------------------------------------------
*/

module.exports = router;