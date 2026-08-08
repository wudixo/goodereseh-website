// server/routes/chat.js
// Powers the commission assistant using Google Gemini Flash (free)
const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = function(app) {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

  app.post('/chat', async (req, res) => {
    try {
      const { messages, system } = req.body;
      if (!messages || !messages.length) {
        return res.status(400).json({ error: 'No messages provided' });
      }

      // Use Gemini 1.5 Flash — free tier, fast, high quality
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: system || ''
      });

      // Convert messages to Gemini format
      // Gemini uses "model" instead of "assistant", and "parts" instead of "content"
      const geminiHistory = [];

      // All messages except the last one go into history
      for (var i = 0; i < messages.length - 1; i++) {
        var msg = messages[i];
        var role = msg.role === 'assistant' ? 'model' : 'user';
        var parts = convertContent(msg.content);
        if (parts.length) geminiHistory.push({ role: role, parts: parts });
      }

      // Last message is sent as the current prompt
      var lastMsg = messages[messages.length - 1];
      var currentParts = convertContent(lastMsg.content);

      // Start chat with history, send current message
      var chat = model.startChat({
        history: geminiHistory,
        generationConfig: { maxOutputTokens: 1200 }
      });

      var result = await chat.sendMessage(currentParts);
      var text = result.response.text();

      res.json({ text: text });

    } catch (err) {
      console.error('Gemini error:', err.message);
      res.status(500).json({ error: err.message || 'AI chat error' });
    }
  });
};

// Convert Anthropic-style content to Gemini parts array
function convertContent(content) {
  if (!content) return [];

  // Simple string message
  if (typeof content === 'string') {
    return [{ text: content }];
  }

  // Array of content parts (text + images)
  if (Array.isArray(content)) {
    var parts = [];
    content.forEach(function(part) {
      if (part.type === 'text' && part.text) {
        parts.push({ text: part.text });
      } else if (part.type === 'image' && part.source) {
        // Convert Anthropic image format to Gemini inlineData
        parts.push({
          inlineData: {
            mimeType: part.source.media_type || 'image/jpeg',
            data: part.source.data
          }
        });
      }
    });
    return parts;
  }

  return [{ text: String(content) }];
}
