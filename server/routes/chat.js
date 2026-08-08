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


            /*
            Gemini requires the final conversation turn
            to be a user message.
            */
            while (
                contents.length &&
                contents[contents.length - 1].role === "model"
            ) {
                contents.pop();
            }


            if (!contents.length) {
                return res.status(400).json({
                    error: "No valid conversation content"
                });
            }


            const requestBody = {

                contents: contents,

                generationConfig: {
                    maxOutputTokens: 1000,
                    thinkingConfig: {
                        thinkingLevel: "low"
                    }
                }

            };


            if (system) {

                requestBody.system_instruction = {
                    parts: [
                        {
                            text: system
                        }
                    ]
                };

            }


            const response = await fetch(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key":
                            process.env.GOOGLE_API_KEY
                    },

                    body: JSON.stringify(
                        requestBody
                    )
                }
            );


            const data =
                await response.json();


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


            console.log(
                "[CHAT] Gemini response received"
            );


            const text =
                extractText(data);


            if (!text) {

                console.error(
                    "[CHAT] Gemini returned no readable text:",
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



function convertParts(content) {

    if (!content) {
        return [];
    }


    if (typeof content === "string") {

        return [
            {
                text: content
            }
        ];

    }


    if (!Array.isArray(content)) {

        return [
            {
                text: String(content)
            }
        ];

    }


    const parts = [];


    for (const item of content) {

        if (
            item.type === "text" &&
            item.text
        ) {

            parts.push({
                text: item.text
            });

        }


        if (
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



function extractText(data) {

    if (
        !data ||
        !Array.isArray(data.candidates) ||
        !data.candidates.length
    ) {
        return "";
    }


    const candidate =
        data.candidates[0];


    if (
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
                typeof part.text === "string" &&
                !part.thought
            );

        })
        .map(function (part) {

            return part.text;

        })
        .join("\n")
        .trim();

}