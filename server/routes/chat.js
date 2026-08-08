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


            const input = [];


            for (const message of messages) {

                const role =
                    message.role === "assistant"
                        ? "Assistant"
                        : "User";


                const parts = normalizeContent(
                    message.content,
                    role
                );


                input.push(...parts);
            }


            const body = {
                model: "gemini-3.5-flash",

                input: input,

                system_instruction:
                    system || undefined,

                generation_config: {
                    max_output_tokens: 1000,
                    thinking_level: "minimal"
                }
            };


            const response = await fetch(
                "https://generativelanguage.googleapis.com/v1beta/interactions",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key":
                            process.env.GOOGLE_API_KEY
                    },

                    body: JSON.stringify(body)
                }
            );


            const data = await response.json();


            if (!response.ok) {

                console.error(
                    "[CHAT] Gemini API error:",
                    JSON.stringify(data)
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
                extractText(data);


            if (!text || !text.trim()) {

                console.error(
                    "[CHAT] No output text:",
                    JSON.stringify(data)
                );

                return res.status(500).json({
                    error:
                        "Gemini returned no text"
                });
            }


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



function normalizeContent(
    content,
    role
) {

    const parts = [];


    if (!content) {
        return parts;
    }


    if (typeof content === "string") {

        parts.push({
            type: "text",
            text:
                role +
                ": " +
                content
        });

        return parts;
    }


    if (!Array.isArray(content)) {

        parts.push({
            type: "text",
            text:
                role +
                ": " +
                String(content)
        });

        return parts;
    }


    for (const item of content) {

        if (
            item.type === "text" &&
            item.text
        ) {

            parts.push({
                type: "text",
                text:
                    role +
                    ": " +
                    item.text
            });

        }


        if (
            item.type === "image" &&
            item.source &&
            item.source.data
        ) {

            parts.push({
                type: "image",

                data:
                    item.source.data,

                mime_type:
                    item.source.media_type ||
                    "image/jpeg"
            });

        }

    }


    return parts;

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

        const textParts = [];


        for (const output of data.outputs) {

            if (
                output &&
                typeof output.text ===
                "string"
            ) {

                textParts.push(
                    output.text
                );

            }


            if (
                output &&
                Array.isArray(output.content)
            ) {

                for (
                    const part of output.content
                ) {

                    if (
                        part &&
                        typeof part.text ===
                        "string"
                    ) {

                        textParts.push(
                            part.text
                        );

                    }

                }

            }

        }


        return textParts.join("\n");
    }


    return "";
}