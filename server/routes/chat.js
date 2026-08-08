const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = function(app) {

  app.get('/chat-test', function(req, res) {
    res.json({
      status: 'chat route working',
      google_key_set: !!process.env.GOOGLE_API_KEY
    });
  });

  app.post('/chat', async function(req, res) {
    console.log('[CHAT] incoming request');
    try {
      var messages = req.body.messages;
      var system = req.body.system || '';

      if (!messages || !messages.length) {
        return res.status(400).json({ error: 'No messages' });
      }
      if (!process.env.GOOGLE_API_KEY) {
        return res.status(500).json({ error: 'GOOGLE_API_KEY not set in Railway Variables' });
      }

      var genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      var config = { model: 'gemini-1.5-flash' };
      if (system) config.systemInstruction = system;
      var model = genAI.getGenerativeModel(config);

      var history = [];
      for (var i = 0; i < messages.length - 1; i++) {
        var m = messages[i];
        var role = m.role === 'assistant' ? 'model' : 'user';
        var parts = toParts(m.content);
        if (parts.length) history.push({ role: role, parts: parts });
      }

      var last = messages[messages.length - 1];
      var current = toParts(last.content);
      if (!current.length) return res.status(400).json({ error: 'Empty message' });

      var chat = model.startChat({ history: history, generationConfig: { maxOutputTokens: 1200 } });
      var result = await chat.sendMessage(current);
      var text = result.response.text();
      console.log('[CHAT] reply length:', text.length);
      res.json({ text: text });

    } catch (err) {
      console.error('[CHAT] error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });
};

function toParts(content) {
  if (!content) return [];
  if (typeof content === 'string') return [{ text: content }];
  if (!Array.isArray(content)) return [{ text: String(content) }];
  var parts = [];
  for (var i = 0; i < content.length; i++) {
    var p = content[i];
    if (p.type === 'text' && p.text) parts.push({ text: p.text });
    if (p.type === 'image' && p.source && p.source.data) {
      parts.push({ inlineData: { mimeType: p.source.media_type || 'image/jpeg', data: p.source.data } });
    }
  }
  return parts;
}
