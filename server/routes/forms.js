require("dotenv").config({
    path: require("path").resolve(__dirname, "../.env"),
});

const express = require("express");
const { Resend } = require("resend");
const supabase = require("../supabase");

const router = express.Router();

const resend =
    new Resend(
        process.env.RESEND_API_KEY
    );

const OWNER_EMAIL =
    process.env.OWNER_EMAIL ||
    "goodereseh@gmail.com";

const STORAGE_BUCKET =
    "commission-references";

const MAX_REFERENCES =
    6;

const MAX_IMAGE_BYTES =
    4 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES =
    new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
    ]);


/*
|--------------------------------------------------------------------------
| CONTACT
|--------------------------------------------------------------------------
*/

router.post(
    "/contact",
    async (req, res) => {

        const {
            name,
            email,
            message
        } =
            req.body || {};


        if (
            !name ||
            !email ||
            !message
        ) {

            return res
                .status(400)
                .json({

                    error:
                        "Name, email and message are required."

                });

        }


        try {

            const result =
                await resend
                    .emails
                    .send({

                        from:
                            "Good Ereseh Website <art@goodereseh.com>",

                        to:
                            OWNER_EMAIL,

                        replyTo:
                            email,

                        subject:
                            "New Contact Message | " +
                            name,

                        html: `

                            <div
                                style="
                                    max-width:650px;
                                    margin:0 auto;
                                    padding:30px;
                                    font-family:Arial,sans-serif;
                                    color:#1a1812;
                                    line-height:1.7;
                                "
                            >

                                <h2>
                                    New Website Message
                                </h2>

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
                                    ${escapeHtml(message).replace(
                                        /\n/g,
                                        "<br>"
                                    )}
                                </p>

                            </div>

                        `

                    });


            if (result.error) {

                console.error(
                    "Contact email error:",
                    result.error
                );


                return res
                    .status(500)
                    .json({

                        error:
                            "Failed to send message."

                    });

            }


            return res.json({
                success: true
            });

        }

        catch (error) {

            console.error(
                "Contact form error:",
                error
            );


            return res
                .status(500)
                .json({

                    error:
                        "Failed to send message."

                });

        }

    }
);



/*
|--------------------------------------------------------------------------
| COMMISSION
|--------------------------------------------------------------------------
*/

router.post(
    "/commission",
    async (req, res) => {

        const body =
            req.body || {};


        const name =
            clean(
                body.name
            );


        const email =
            clean(
                body.email
            );


        const phone =
            clean(
                body.phone
            );


        const type =
            clean(

                body["commission-type"] ||

                body.commissionType ||

                body.type

            );


        const size =
            clean(
                body.size
            );


        const message =
            clean(

                body.message ||

                body.brief ||

                body.description

            );


        const notes =
            clean(
                body.notes
            );


        const conversation =
            normaliseConversation(

                body.conversation ||

                body.messages ||

                body.chatHistory

            );


        const completeBrief =

            notes

                ? (
                    message +

                    "\n\nFinal notes:\n" +

                    notes
                )

                : message;


        const address =
            normaliseAddress(
                body
            );


        const consent =
            toBoolean(

                body.referenceConsent ??

                body.reference_consent ??

                body.photoConsent ??

                body.photo_consent ??

                body.consent

            );


        let references =
            normaliseReferences(

                body.references ||

                body.referenceImages ||

                body.reference_images

            );


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

                    label:
                        "Reference 1",

                    fileName:
                        "reference-1.jpg"

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

            return res
                .status(400)
                .json({

                    error:
                        "Name, email and phone number are required."

                });

        }


        if (
            !isValidEmail(
                email
            )
        ) {

            return res
                .status(400)
                .json({

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

            return res
                .status(400)
                .json({

                    error:
                        "Address line 1, city, postcode and country are required."

                });

        }


        if (
            references.length >
            MAX_REFERENCES
        ) {

            return res
                .status(400)
                .json({

                    error:
                        `You can upload a maximum of ${MAX_REFERENCES} reference images.`

                });

        }


        if (
            references.length &&
            !consent
        ) {

            return res
                .status(400)
                .json({

                    error:
                        "Please confirm that you have permission to provide and use the reference photographs."

                });

        }



        const commissionNumber =
            createCommissionNumber();


        const uploadedReferences =
            [];


        try {


            /*
            |--------------------------------------------------------------------------
            | UPLOAD REFERENCES
            |--------------------------------------------------------------------------
            */

            for (
                let index = 0;
                index < references.length;
                index++
            ) {

                const uploaded =
                    await uploadReferenceImage(

                        commissionNumber,

                        references[index],

                        index

                    );


                uploadedReferences.push(
                    uploaded
                );

            }



            /*
            |--------------------------------------------------------------------------
            | DATABASE
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
                    completeBrief,

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


            const expandedRecord = {

                ...baseRecord,

                customer_address:
                    address,

                reference_consent:
                    consent,

                conversation:
                    conversation,

                commission_brief: {

                    commission_type:
                        type || null,

                    artwork_size:
                        size || null,

                    medium:
                        "Charcoal and Graphite",

                    customer_description:
                        completeBrief || null,

                    references:
                        uploadedReferences

                }

            };


            let result =
                await supabase

                    .from(
                        "commissions"
                    )

                    .insert(
                        expandedRecord
                    )

                    .select()

                    .single();


            if (
                result.error &&
                isMissingColumnError(
                    result.error
                )
            ) {

                console.warn(

                    "Using compatible commission schema:",

                    result.error.message

                );


                result =
                    await supabase

                        .from(
                            "commissions"
                        )

                        .insert(
                            baseRecord
                        )

                        .select()

                        .single();

            }


            if (
                result.error ||
                !result.data
            ) {

                console.error(
                    "Supabase commission error:",
                    result.error
                );


                await cleanupUploadedReferences(
                    uploadedReferences
                );


                return res
                    .status(500)
                    .json({

                        error:
                            "Unable to save commission request."

                    });

            }



            /*
            |--------------------------------------------------------------------------
            | EMAIL IMAGE ATTACHMENTS
            |--------------------------------------------------------------------------
            */

            const ownerAttachments =

                references.map(

                    function(
                        reference,
                        index
                    ) {

                        return {

                            filename:

                                reference.fileName ||

                                `reference-${index + 1}.jpg`,

                            content:

                                stripDataUrl(
                                    reference.data
                                ),

                            contentId:

                                `reference-${index + 1}`

                        };

                    }

                );



            /*
            |--------------------------------------------------------------------------
            | OWNER EMAIL
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

                    message:
                        completeBrief,

                    address,

                    consent,

                    references:
                        uploadedReferences

                });


            const ownerEmailResult =
                await resend
                    .emails
                    .send({

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
                            ownerHtml,

                        attachments:
                            ownerAttachments

                    });


            if (
                ownerEmailResult.error
            ) {

                console.error(

                    "Owner commission email error:",

                    ownerEmailResult.error

                );

            }



            /*
            |--------------------------------------------------------------------------
            | CUSTOMER EMAIL
            |--------------------------------------------------------------------------
            */

            const customerEmailResult =
                await resend
                    .emails
                    .send({

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

                                size

                            })

                    });


            if (
                customerEmailResult.error
            ) {

                console.error(

                    "Customer commission email error:",

                    customerEmailResult.error

                );

            }



            /*
            |--------------------------------------------------------------------------
            | SUCCESS
            |--------------------------------------------------------------------------
            */

            return res
                .status(201)
                .json({

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


            return res
                .status(500)
                .json({

                    error:

                        error.message ||

                        "Failed to process commission request. Please email art@goodereseh.com directly."

                });

        }

    }
);



/*
|--------------------------------------------------------------------------
| UPLOAD IMAGE
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


    if (
        !ALLOWED_IMAGE_TYPES.has(
            mimeType
        )
    ) {

        throw new Error(
            "Reference images must be JPEG, PNG or WebP."
        );

    }


    const cleanBase64 =
        stripDataUrl(
            reference.data
        );


    if (!cleanBase64) {

        throw new Error(

            `Reference ${index + 1} does not contain image data.`

        );

    }


    const buffer =
        Buffer.from(

            cleanBase64,

            "base64"

        );


    if (!buffer.length) {

        throw new Error(

            `Reference ${index + 1} is empty.`

        );

    }


    if (
        buffer.length >
        MAX_IMAGE_BYTES
    ) {

        throw new Error(

            `Reference ${index + 1} is too large. Maximum size is 4 MB.`

        );

    }


    const extension =
        getExtensionFromMimeType(
            mimeType
        );


    const path =

        commissionNumber +

        "/reference-" +

        String(
            index + 1
        ).padStart(
            2,
            "0"
        ) +

        "-" +

        Date.now() +

        "." +

        extension;


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
            "Reference upload error:",
            uploadError
        );


        throw new Error(

            `Reference ${index + 1} could not be uploaded.`

        );

    }


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
| CLEANUP
|--------------------------------------------------------------------------
*/

async function cleanupUploadedReferences(
    references
) {

    const paths =
        references

            .map(
                function(reference) {

                    return reference.path;

                }
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
| OWNER EMAIL
|--------------------------------------------------------------------------
*/

function buildOwnerEmail(data) {

    const referenceList =

        data.references.length

            ? data.references

                .map(
                    function(
                        reference,
                        index
                    ) {

                        return `

                            <div
                                style="
                                    margin-bottom:28px;
                                "
                            >

                                <p
                                    style="
                                        margin-bottom:8px;
                                    "
                                >

                                    <strong>

                                        ${escapeHtml(
                                            reference.label ||
                                            `Reference ${index + 1}`
                                        )}

                                    </strong>

                                </p>


                                <img

                                    src="cid:reference-${index + 1}"

                                    alt=""

                                    style="
                                        display:block;
                                        width:100%;
                                        max-width:420px;
                                        height:auto;
                                        border-radius:8px;
                                        border:1px solid #ddd6ce;
                                    "

                                >

                            </div>

                        `;

                    }
                )

                .join("")

            : "<p>No reference photographs supplied.</p>";


    return `

        <div

            style="
                max-width:760px;
                margin:0 auto;
                padding:32px;
                font-family:Arial,sans-serif;
                color:#1a1812;
                line-height:1.7;
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
                ${escapeHtml(
                    data.name
                )}

                <br>


                <strong>Email:</strong>
                ${escapeHtml(
                    data.email
                )}

                <br>


                <strong>Phone:</strong>
                ${escapeHtml(
                    data.phone
                )}

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

                <strong>
                    Type:
                </strong>

                ${escapeHtml(
                    data.type ||
                    "Not specified"
                )}

                <br>


                <strong>
                    Size:
                </strong>

                ${escapeHtml(
                    data.size ||
                    "Not selected"
                )}

                <br>


                <strong>
                    Medium:
                </strong>

                Charcoal and Graphite

                <br>


                <strong>
                    Photo permission confirmed:
                </strong>

                ${
                    data.consent

                        ? "Yes"

                        : "Not applicable / No reference photographs"
                }

            </p>



            <h3>
                Commission Brief
            </h3>


            <div

                style="
                    background:#f7f4ef;
                    padding:18px;
                    border-radius:8px;
                    line-height:1.75;
                    margin-bottom:24px;
                "

            >

                ${escapeHtml(
                    data.message ||
                    "No commission brief supplied."
                ).replace(
                    /\n/g,
                    "<br>"
                )}

            </div>



            <h3>
                Reference Photographs
            </h3>


            ${referenceList}



            <hr
                style="
                    border:none;
                    border-top:1px solid #ddd6ce;
                    margin:30px 0;
                "
            >


            <p>

                <strong>
                    Next step:
                </strong>

                Review the commission brief and reference photographs.

                No payment has been requested.

                Prepare the concept where needed,
                confirm the quotation,
                then send the customer their private payment link.

            </p>


        </div>

    `;

}



/*
|--------------------------------------------------------------------------
| CUSTOMER EMAIL
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

                Dear ${escapeHtml(
                    data.name
                )},

            </p>


            <p>

                Thank you for sharing your idea with Good Ereseh Studio.

                Your commission request has been received for review.

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

            </p>


            <p>

                Good Ereseh will review your commission brief and any reference photographs you supplied.

            </p>


            <p>

                If a visual concept is required, it will be prepared for your review.

                Once the concept, quotation and expected completion time are agreed,
                you will receive a private payment link.

            </p>


            <p>

                Please keep your commission reference for future correspondence.

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
| REFERENCES
|--------------------------------------------------------------------------
*/

function normaliseReferences(value) {

    if (!value) {

        return [];

    }


    let references =
        value;


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
                references
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
            function(
                reference,
                index
            ) {

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
                            `Reference ${index + 1}`,

                        fileName:
                            `reference-${index + 1}.jpg`

                    };

                }


                const imageData =

                    reference.data ||

                    reference.base64 ||

                    reference.imageB64 ||

                    reference.src ||

                    "";


                return {

                    data:
                        imageData,

                    mimeType:

                        reference.mimeType ||

                        reference.media_type ||

                        reference.imageType ||

                        reference.type ||

                        getMimeTypeFromDataUrl(
                            imageData
                        ),

                    label:

                        reference.label ||

                        `Reference ${index + 1}`,

                    fileName:

                        reference.fileName ||

                        reference.filename ||

                        reference.name ||

                        `reference-${index + 1}.jpg`

                };

            }
        )

        .filter(
            function(reference) {

                return reference.data;

            }
        );

}



/*
|--------------------------------------------------------------------------
| CONVERSATION
|--------------------------------------------------------------------------
*/

function normaliseConversation(value) {

    if (!value) {

        return [];

    }


    let conversation =
        value;


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
            function(item) {

                if (!item) {

                    return null;

                }


                if (
                    typeof item ===
                    "string"
                ) {

                    return {

                        role:
                            "user",

                        text:
                            clean(
                                item
                            )

                    };

                }


                const role =

                    item.role ===
                    "assistant" ||

                    item.role ===
                    "model"

                        ? "assistant"

                        : "user";


                const text =
                    clean(

                        item.text ||

                        item.content ||

                        ""

                    );


                if (!text) {

                    return null;

                }


                return {

                    role:
                        role,

                    text:
                        text

                };

            }
        )

        .filter(Boolean)

        .slice(
            -100
        );

}



/*
|--------------------------------------------------------------------------
| ADDRESS
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
| HELPERS
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


function clean(value) {

    return String(
        value ?? ""
    ).trim();

}


function toBoolean(value) {

    if (
        value === true ||
        value === 1
    ) {

        return true;

    }


    return [

        "true",

        "1",

        "yes",

        "on",

        "confirmed"

    ].includes(

        clean(value)
            .toLowerCase()

    );

}


function isValidEmail(value) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(
            value
        );

}


function stripDataUrl(value) {

    return clean(value)
        .replace(

            /^data:[^;]+;base64,/,

            ""

        );

}


function getMimeTypeFromDataUrl(value) {

    const match =

        clean(value)
            .match(

                /^data:([^;]+);base64,/

            );


    return match

        ? match[1]
            .toLowerCase()

        : "image/jpeg";

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


        default:

            return "jpg";

    }

}


function escapeHtml(value) {

    return String(
        value ?? ""
    ).replace(

        /[&<>"']/g,

        function(character) {

            switch (
                character
            ) {

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


function formatAddressHtml(
    address
) {

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

        .join(
            "<br>"
        );

}


function isMissingColumnError(
    error
) {

    if (!error) {

        return false;

    }


    const text = [

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


module.exports =
    router;