// server/routes/forms.js — updated with image attachment + Stripe deposit
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const router  = express.Router();
const { Resend } = require('resend');
const resend   = new Resend(process.env.RESEND_API_KEY);
const OWNER    = process.env.OWNER_EMAIL || 'goodereseh@gmail.com';

/* ── CONTACT ────────────────────────────────────────── */
router.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message)
    return res.status(400).json({ error: 'Name, email and message are required.' });

  try {
    await resend.emails.send({
      from: 'Good Ereseh Website <art@goodereseh.com>',
      to: OWNER,
      replyTo: email,
      subject: 'New Contact Message — ' + name,
      html: '<p><strong>From:</strong> ' + name + ' &lt;' + email + '&gt;</p><p>' + message.replace(/\n/g,'<br>') + '</p>'
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

/* ── COMMISSION ─────────────────────────────────────── */
router.post('/commission', async (req, res) => {
  const {
    name, email, phone,
    'commission-type': type,
    size, message,
    imageB64, imageType,   // reference photo (compressed, base64)
    conceptUrl             // Pollinations AI concept URL
  } = req.body;

  if (!name || !email)
    return res.status(400).json({ error: 'Name and email are required.' });

  // -- Build owner email HTML
  const ownerHtml = `
<!DOCTYPE html><html><body style="font-family:Georgia,serif;color:#1a1812;max-width:600px;margin:0 auto;padding:24px;">
<h1 style="font-size:28px;font-weight:300;margin-bottom:4px;">New Commission Brief</h1>
<p style="color:#6b7280;font-size:13px;margin-top:0;">Good Ereseh &middot; Commission Assistant</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
<table style="width:100%;border-collapse:collapse;">
  <tr><td style="padding:8px 0;font-size:13px;color:#6b7280;width:130px;">Name</td><td style="padding:8px 0;font-size:14px;">${name}</td></tr>
  <tr><td style="padding:8px 0;font-size:13px;color:#6b7280;">Email</td><td style="padding:8px 0;font-size:14px;"><a href="mailto:${email}">${email}</a></td></tr>
  <tr><td style="padding:8px 0;font-size:13px;color:#6b7280;">Phone</td><td style="padding:8px 0;font-size:14px;">${phone||'Not provided'}</td></tr>
  <tr><td style="padding:8px 0;font-size:13px;color:#6b7280;">Type</td><td style="padding:8px 0;font-size:14px;">${type||'—'}</td></tr>
  <tr><td style="padding:8px 0;font-size:13px;color:#6b7280;">Size</td><td style="padding:8px 0;font-size:14px;">${size||'—'}</td></tr>
</table>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
<h3 style="font-size:14px;font-weight:400;color:#6b7280;letter-spacing:.05em;text-transform:uppercase;">Brief</h3>
<p style="font-size:14px;line-height:1.8;white-space:pre-wrap;">${message||''}</p>
${conceptUrl ? '<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"><h3 style="font-size:14px;font-weight:400;color:#6b7280;letter-spacing:.05em;text-transform:uppercase;">AI Concept</h3><img src="'+conceptUrl+'" style="max-width:100%;border-radius:4px;" alt="AI Concept">' : ''}
${imageB64 ? '<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"><p style="font-size:13px;color:#6b7280;"><strong>Reference photo attached</strong> &mdash; see attachment below.</p>' : ''}
</body></html>`;

  // -- Build attachments array
  const attachments = [];
  if (imageB64) {
    // Remove data URL prefix if present
    const cleanB64 = imageB64.replace(/^data:[^;]+;base64,/, '');
    attachments.push({
      filename: 'reference-photo.jpg',
      content: cleanB64,
    });
  }

  try {
    // Send to owner
    await resend.emails.send({
      from: 'Good Ereseh <art@goodereseh.com>',
      to: OWNER,
      replyTo: email,
      subject: 'Commission Brief — ' + name,
      html: ownerHtml,
      attachments: attachments
    });

    // Send confirmation to customer
    await resend.emails.send({
      from: 'Good Ereseh <art@goodereseh.com>',
      to: email,
      subject: 'Your Commission Brief — Good Ereseh',
      html: `<!DOCTYPE html><html><body style="font-family:Georgia,serif;color:#1a1812;max-width:600px;margin:0 auto;padding:24px;">
<h1 style="font-size:28px;font-weight:300;">Brief Received</h1>
<p style="font-size:15px;line-height:1.8;">Thank you, ${name}. Good Ereseh has received your commission brief and will be in touch within two business days to confirm details and send your deposit invoice.</p>
<p style="font-size:13px;color:#6b7280;margin-top:24px;">Good Ereseh &middot; Charcoal &amp; Graphite Artist &middot; London<br><a href="https://goodereseh.com">goodereseh.com</a></p>
</body></html>`
    });

    // Create Stripe checkout for deposit
    let paymentUrl = null;
    try {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: email,
        line_items: [{
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'Commission Deposit — Good Ereseh',
              description: (type || 'Commission') + (size ? ' · ' + size : '') + ' · 50% initial deposit'
            },
            unit_amount: 5000, // £50 booking deposit — Good Ereseh invoices the full 50% separately
          },
          quantity: 1
        }],
        success_url: 'https://goodereseh.com/success?type=deposit&name=' + encodeURIComponent(name),
        cancel_url:  'https://goodereseh.com/commissions',
        metadata: { customer_name: name, customer_email: email, commission_type: type || '' }
      });
      paymentUrl = session.url;
    } catch (stripeErr) {
      console.error('Stripe error (non-fatal):', stripeErr.message);
      // Don't fail the whole request if Stripe has an issue
    }

    res.json({ success: true, paymentUrl: paymentUrl });

  } catch (err) {
    console.error('Commission error:', err);
    res.status(500).json({ error: 'Failed to send brief. Please email art@goodereseh.com directly.' });
  }
});

module.exports = router;
