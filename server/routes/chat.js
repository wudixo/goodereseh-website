const { GoogleGenAI } = require("@google/genai");

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


            const ai = new GoogleGenAI({
                apiKey: process.env.GOOGLE_API_KEY
            });


            const contents = [];


            for (const msg of messages) {

                const role =
                    msg.role === "assistant"
                        ? "model"
                        : "user";


                const parts =
                    convertParts(msg.content);


                if (parts.length) {

                    contents.push({
                        role: role,
                        parts: parts
                    });

                }

            }


            const response =
                await ai.models.generateContent({

                    model: "gemini-3.6-flash",

                    contents: contents,

                    config: {

                        systemInstruction:
                            system || undefined,

                        maxOutputTokens:
                            1000

                    }

                });


            const text =
                response.text ||
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
            text: content
        }];

    }


    if (!Array.isArray(content)) {

        return [{
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
                text: item.text
            });

        }


        if (
            item.type === "image" &&
            item.source &&
            item.source.data
        ) {

            parts.push({

                inlineData: {

                    mimeType:
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