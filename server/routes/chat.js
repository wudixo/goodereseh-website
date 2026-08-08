module.exports = function (app) {

    app.get("/chat-test", function (req, res) {

        res.json({
            status: "working",
            google_key_set: !!process.env.GOOGLE_API_KEY
        });

    });


    app.post("/chat", async function (req, res) {

        console.log("[CHAT] request received");

        try {

            const messages = req.body.messages;
            const system = req.body.system || "";

            if (!messages || !messages.length) {

                return res.status(400).json({
                    error: "No messages"
                });

            }

            if (!process.env.GOOGLE_API_KEY) {

                return res.status(500).json({
                    error: "GOOGLE_API_KEY not set"
                });

            }


            const contents = [];


            for (const message of messages) {

                const role =
                    message.role === "assistant"
                        ? "model"
                        : "user";


                const parts =
                    convertParts(message.content);


                if (parts.length) {

                    contents.push({
                        role: role,
                        parts: parts
                    });

                }

            }


            const body = {

                model: "gemini-3.6-flash",

                input: buildInteractionInput(contents),

                system_instruction:
                    system || undefined,

                generation_config: {
                    max_output_tokens: 1000
                }

            };


            const response = await fetch(
                "https://generativelanguage.googleapis.com/v1beta/interactions",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": process.env.GOOGLE_API_KEY
                    },

                    body: JSON.stringify(body)
                }
            );


            const data =
                await response.json();


            if (!response.ok) {

                console.error(
                    "[CHAT] Gemini API error:",
                    data
                );

                return res.status(
                    response.status
                ).json({
                    error:
                        data?.error?.message ||
                        "Gemini request failed"
                });

            }


            const text =
                extractText(data) ||
                "Thank you. Could you tell me a little more about what you have in mind for this commission?";


            console.log(
                "[CHAT] reply chars:",
                text.length
            );


            res.json({
                text: text
            });

        }

        catch (error) {

            console.error(
                "[CHAT] error:",
                error
            );


            res.status(500).json({
                error:
                    error.message ||
                    "AI request failed"
            });

        }

    });

};



function convertParts(content) {

    if (!content) {
        return [];
    }


    if (typeof content === "string") {

        return [{
            type: "text",
            text: content
        }];

    }


    if (!Array.isArray(content)) {

        return [{
            type: "text",
            text: String(content)
        }];

    }


    const parts = [];


    for (const item of content) {

        if (
            item.type === "text" &&
            item.text
        ) {

            parts.push({
                type: "text",
                text: item.text
            });

        }


        if (
            item.type === "image" &&
            item.source &&
            item.source.data
        ) {

            parts.push({

                type: "image",

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



function buildInteractionInput(contents) {

    const input = [];


    for (const message of contents) {

        for (const part of message.parts) {

            if (
                part.type === "text"
            ) {

                input.push({
                    type: "text",
                    text:
                        message.role === "model"
                            ? "Assistant: " + part.text
                            : "User: " + part.text
                });

            }


            if (
                part.type === "image"
            ) {

                input.push({
                    type: "image",
                    inline_data:
                        part.inline_data
                });

            }

        }

    }


    return input;

}



function extractText(data) {

    if (
        typeof data.output_text ===
        "string"
    ) {

        return data.output_text;

    }


    if (
        Array.isArray(data.outputs)
    ) {

        const pieces = [];

        for (const output of data.outputs) {

            if (
                output &&
                typeof output.text ===
                "string"
            ) {

                pieces.push(
                    output.text
                );

            }

        }

        return pieces.join("\n");

    }


    return "";

}