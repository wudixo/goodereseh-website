// server/routes/chat.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = function(app) {

  // Test endpoint — visit /chat-test in browser to confirm this file is deployed
  app.get('/chat-test', function(req, res) {
    var hasKey = !!process.env.GOOGLE_API_KEY;
    res.json({
      status: 'chat route is mounted',
      google_key_set: hasKey,
      key_preview: hasKey ? process.env.GOOGLE_API_KEY.substring(0, 10) + '...' : 'MISSING - add GOOGLE_API_KEY to Railway Variables'
    });
  });

  app.post('/chat', async function(req, res) {
    console.log('[CHAT] Request received');

    try {
      var messages = req.body.messages;
      var system   = req.body.system || '';

      if (!messages || !messages.length) {
        console.log('[CHAT] Error: no messages');
        return res.status(400).json({ error: 'No messages provided' });
      }

      if (!process.env.GOOGLE_API_KEY) {
        console.error('[CHAT] Error: GOOGLE_API_KEY not set');
        return res.status(500).json({ error: 'GOOGLE_API_KEY is not set in Railway Variables' });
      }

      var genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

      var modelConfig = { model: 'gemini-1.5-flash' };
      if (system) modelConfig.systemInstruction = system;

      var model = genAI.getGenerativeModel(modelConfig);
      console.log('[CHAT] Model ready, message count:', messages.length);

      // Convert all messages except the last into Gemini history
      var geminiHistory = [];
      for (var i = 0; i < messages.length - 1; i++) {
        var msg  = messages[i];
        var role = msg.role === 'assistant' ? 'model' : 'user';
        var parts = toParts(msg.content);
        if (parts.length) geminiHistory.push({ role: role, parts: parts });
      }

      // Last message is the current prompt
      var lastMsg      = messages[messages.length - 1];
      var currentParts = toParts(lastMsg.content);

      if (!currentParts.length) {
        return res.status(400).json({ error: 'Empty message' });
      }

      var chat = model.startChat({
        history: geminiHistory,
        generationConfig: { maxOutputTokens: 1200 }
      });

      var result = await chat.sendMessage(currentParts);
      var text   = result.response.text();

      console.log('[CHAT] Gemini replied, length:', text.length);
      res.json({ text: text });

    } catch (err) {
      console.error('[CHAT] Error:', err.message);
      res.status(500).json({ error: err.message || 'AI chat error' });
    }
  });
};

// Convert message content to Gemini parts array
function toParts(content) {
  if (!content) return [];
  if (typeof content === 'string') return [{ text: content }];
  if (!Array.isArray(content)) return [{ text: String(content) }];

  var parts = [];
  content.forEach(function(part) {
    if (part.type === 'text' && part.text) {
