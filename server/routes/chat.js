module.exports = function (app) {

    /*
    |--------------------------------------------------------------------------
    | CHAT HEALTH CHECK
    |--------------------------------------------------------------------------
    */

    app.get("/chat-test", function (req, res) {

        res.json({
            status: "working",
            google_key_set: !!process.env.GOOGLE_API_KEY
        });

    });


    /*
    |--------------------------------------------------------------------------
    | GOOD ERESEH AI CHAT
    |--------------------------------------------------------------------------
    */

    app.post("/chat", async function (req, res) {

        console.log("[CHAT] request received");

        try {

            const messages = req.body.messages;
            const system = req.body.system || "";


            /*
            |--------------------------------------------------------------------------
            | BASIC VALIDATION
            |--------------------------------------------------------------------------
            */

            if (!messages || !Array.isArray(messages) || !messages.length) {

                return res.status(400).json({
                    error: "Please send a message to continue."
                });

            }


            if (!process.env.GOOGLE_API_KEY) {

                console.error(
                    "[CHAT] GOOGLE_API_KEY is missing"
                );

                return res.status(500).json({
                    error:
                        "The studio assistant is temporarily unavailable. Please try again shortly."
                });

            }


            /*
            |--------------------------------------------------------------------------
            | BUILD GEMINI CONVERSATION
            |--------------------------------------------------------------------------
            |
            | Keep a reasonable amount of conversation history.
            | This keeps the assistant aware of earlier answers without sending
            | an unnecessarily large conversation on every request.
            |--------------------------------------------------------------------------
            */

            const recentMessages =
                messages.slice(-24);

            const contents = [];


            for (const message of recentMessages) {

                const role =
                    message.role === "assistant"
                        ? "model"
                        : "user";


                const parts =
                    convertParts(
                        message.content
                    );


                if (parts.length) {

                    contents.push({
                        role: role,
                        parts: parts
                    });

                }

            }


            /*
            |--------------------------------------------------------------------------
            | GEMINI REQUIRES A USER MESSAGE AS THE CURRENT TURN
            |--------------------------------------------------------------------------
            */

            while (
                contents.length &&
                contents[contents.length - 1].role === "model"
            ) {

                contents.pop();

            }


            if (!contents.length) {

                return res.status(400).json({
                    error:
                        "I couldn't understand that message. Please try again."
                });

            }


            /*
            |--------------------------------------------------------------------------
            | REQUEST BODY
            |--------------------------------------------------------------------------
            */

            const requestBody = {

                contents: contents,

                generationConfig: {

                    maxOutputTokens:
                        1000

                }

            };


            /*
            |--------------------------------------------------------------------------
            | SYSTEM INSTRUCTION
            |--------------------------------------------------------------------------
            */

            if (system) {

                requestBody.system_instruction = {

                    parts: [
                        {
                            text: system
                        }
                    ]

                };

            }


            /*
            |--------------------------------------------------------------------------
            | CALL GEMINI
            |--------------------------------------------------------------------------
            */

            const response =
                await fetch(
                    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json",

                            "x-goog-api-key":
                                process.env.GOOGLE_API_KEY

                        },

                        body:
                            JSON.stringify(
                                requestBody
                            )

                    }
                );


            const data =
                await response.json();


            /*
            |--------------------------------------------------------------------------
            | RATE LIMIT / QUOTA HANDLING
            |--------------------------------------------------------------------------
            */

            if (response.status === 429) {

                console.warn(
                    "[CHAT] Gemini rate limit reached:",
                    JSON.stringify(data)
                );


                const retrySeconds =
                    getRetrySeconds(data);


                return res
                    .status(429)
                    .json({

                        error:
                            retrySeconds
                                ? `The studio assistant is busy at the moment. Please wait about ${retrySeconds} seconds and try again.`
                                : "The studio assistant is busy at the moment. Please wait a short while and try again.",

                        code:
                            "AI_RATE_LIMIT",

                        retryAfter:
                            retrySeconds

                    });

            }


            /*
            |--------------------------------------------------------------------------
            | OTHER GEMINI ERRORS
            |--------------------------------------------------------------------------
            */

            if (!response.ok) {

                console.error(
                    "[CHAT] Gemini API error:",
                    JSON.stringify(data)
                );


                if (
                    response.status >= 500
                ) {

                    return res
                        .status(503)
                        .json({

                            error:
                                "The studio assistant is temporarily unavailable. Please try again shortly.",

                            code:
                                "AI_TEMPORARILY_UNAVAILABLE"

                        });

                }


                return res
                    .status(500)
                    .json({

                        error:
                            "I couldn't process that message. Please try again.",

                        code:
                            "AI_REQUEST_FAILED"

                    });

            }


            /*
            |--------------------------------------------------------------------------
            | EXTRACT AI RESPONSE
            |--------------------------------------------------------------------------
            */

            const text =
                extractText(data);


            if (!text) {

                console.error(
                    "[CHAT] Gemini returned no readable text:",
                    JSON.stringify(data)
                );


                return res
                    .status(502)
                    .json({

                        error:
                            "I couldn't complete that response. Please try your message again.",

                        code:
                            "AI_EMPTY_RESPONSE"

                    });

            }


            console.log(
                "[CHAT] reply chars:",
                text.length
            );


            /*
            |--------------------------------------------------------------------------
            | RETURN MESSAGE TO COMMISSION PAGE
            |--------------------------------------------------------------------------
            */

            return res.json({
                text: text
            });

        }

        catch (error) {

            console.error(
                "[CHAT] unexpected error:",
                error
            );


            return res
                .status(500)
                .json({

                    error:
                        "The studio assistant is temporarily unavailable. Please try again shortly.",

                    code:
                        "AI_SERVER_ERROR"

                });

        }

    });

};



/*
|--------------------------------------------------------------------------
| CONVERT CHAT CONTENT TO GEMINI PARTS
|--------------------------------------------------------------------------
*/

function convertParts(content) {

    if (!content) {

        return [];

    }


    /*
    |--------------------------------------------------------------------------
    | SIMPLE TEXT
    |--------------------------------------------------------------------------
    */

    if (
        typeof content === "string"
    ) {

        return [
            {
                text: content
            }
        ];

    }


    /*
    |--------------------------------------------------------------------------
    | OTHER NON-ARRAY VALUE
    |--------------------------------------------------------------------------
    */

    if (
        !Array.isArray(content)
    ) {

        return [
            {
                text:
                    String(content)
            }
        ];

    }


    const parts = [];


    /*
    |--------------------------------------------------------------------------
    | MULTIMODAL CONTENT
    |--------------------------------------------------------------------------
    */

    for (const item of content) {

        /*
        | Text
        */

        if (
            item &&
            item.type === "text" &&
            item.text
        ) {

            parts.push({
                text:
                    item.text
            });

        }


        /*
        | Customer reference photograph
        |
        | IMPORTANT:
        | The photograph is sent to Gemini for visual understanding only.
        | Gemini is NOT being asked to regenerate or replace the image.
        */

        if (
            item &&
            item.type === "image" &&
            item.source &&
            item.source.data
        ) {

            parts.push({

                inline_data: {

                    mime_type:
                        item.source.media_type ||
                        "image/jpeg",

                    data:
                        item.source.data

                }

            });

        }

    }


    return parts;

}



/*
|--------------------------------------------------------------------------
| EXTRACT GEMINI RESPONSE TEXT
|--------------------------------------------------------------------------
*/

function extractText(data) {

    if (
        !data ||
        !Array.isArray(
            data.candidates
        ) ||
        !data.candidates.length
    ) {

        return "";

    }


    const candidate =
        data.candidates[0];


    if (
        !candidate ||
        !candidate.content ||
        !Array.isArray(
            candidate.content.parts
        )
    ) {

        return "";

    }


    return candidate.content.parts

        .filter(function (part) {

            return (
                part &&
                typeof part.text ===
                    "string" &&
                !part.thought
            );

        })

        .map(function (part) {

            return part.text;

        })

        .join("\n")

        .trim();

}



/*
|--------------------------------------------------------------------------
| READ GOOGLE RETRY DELAY
|--------------------------------------------------------------------------
*/

function getRetrySeconds(data) {

    try {

        if (
            !data ||
            !data.error ||
            !Array.isArray(
                data.error.details
            )
        ) {

            return null;

        }


        for (
            const detail of
            data.error.details
        ) {

            if (
                detail &&
                typeof detail.retryDelay ===
                    "string"
            ) {

                const match =
                    detail.retryDelay.match(
                        /([\d.]+)s/
                    );


                if (match) {

                    return Math.ceil(
                        Number(match[1])
                    );

                }

            }

        }

    }

    catch (error) {

        console.error(
            "[CHAT] Could not read retry delay:",
            error.message
        );

    }


    return null;

}