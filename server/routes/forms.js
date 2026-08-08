const express = require("express");
const router = express.Router();
const { Resend } = require("resend");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
        switch (char) {
            case "&":  return "&amp;";
            case "<":  return "&lt;";
            case ">":  return "&gt;";
            case '"':  return "&quot;";
            case "'":  return "&#39;";
            default:   return char;
        }
    });
}

// ── POST /contact ────────────────────────────────────────────────────────────
router.post("/contact", async (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: "Name, email and message are required." });
    }

    const safe = {
        name:    escapeHtml(name),
        email:   escapeHtml(email),
        subject: escapeHtml(subject || "General enquiry"),
        message: escapeHtml(message),
    };

    try {
        await resend.emails.send({
            from:    "Good Ereseh <art@goodereseh.com>",
            to:      process.env.OWNER_EMAIL,
            replyTo: email,
            subject: `Contact: ${safe.subject} — ${safe.name}`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f1ec;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr>
    <td style="background:#0f0d0b;padding:36px 48px;text-align:center;">
      <div style="font-family:Georgia,serif;font-size:28px;font-weight:300;color:#f0e8d8;letter-spacing:0.12em;">G &middot; E</div>
      <div style="font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:#5c5449;margin-top:6px;">Good Ereseh</div>
    </td>
  </tr>

  <tr>
    <td style="background:#1a1612;padding:18px 48px;text-align:center;border-bottom:1px solid #2c271f;">
      <div style="font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#8c8278;">New Contact Enquiry</div>
    </td>
  </tr>

  <tr>
    <td style="background:#0f0d0b;padding:40px 48px;">
      <div style="font-size:8px;letter-spacing:0.28em;text-transform:uppercase;color:#5c5449;margin-bottom:16px;">Message Details</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #1a1612;width:35%;">
            <span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#5c5449;">From</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #1a1612;text-align:right;">
            <span style="font-size:13px;color:#e4dbd0;">${safe.name}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #1a1612;">
            <span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#5c5449;">Email</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #1a1612;text-align:right;">
            <a href="mailto:${safe.email}" style="font-size:13px;color:#8c8278;text-decoration:none;">${safe.email}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #1a1612;">
            <span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#5c5449;">Subject</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #1a1612;text-align:right;">
            <span style="font-size:13px;color:#e4dbd0;">${safe.subject}</span>
          </td>
        </tr>
      </table>

      <div style="height:1px;background:#1a1612;margin:28px 0;"></div>
      <div style="font-size:8px;letter-spacing:0.28em;text-transform:uppercase;color:#5c5449;margin-bottom:14px;">Message</div>
      <div style="font-size:14px;color:#8c8278;line-height:1.85;white-space:pre-line;">${safe.message}</div>

      <div style="height:1px;background:#1a1612;margin:28px 0;"></div>
      <div style="font-size:11px;color:#3d3830;">Reply directly to this email to respond to ${safe.name}.</div>
    </td>
  </tr>

  <tr>
    <td style="background:#181512;padding:24px 48px;text-align:center;border-top:1px solid #2c271f;">
      <div style="font-size:9px;letter-spacing:0.15em;color:#3d3830;">Good Ereseh &middot; art@goodereseh.com &middot; goodereseh.com</div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`,
        });

        res.json({ success: true });
    } catch (err) {
        console.error("Contact form error:", err);
        res.status(500).json({ error: "Failed to send message. Please email art@goodereseh.com directly." });
    }
});

// ── POST /commission ─────────────────────────────────────────────────────────
router.post("/commission", async (req, res) => {
    const { name, email, "commission-type": commissionType, size, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: "Name, email and message are required." });
    }

    const safe = {
        name:           escapeHtml(name),
        email:          escapeHtml(email),
        commissionType: escapeHtml(commissionType || "Not specified"),
        size:           escapeHtml(size           || "Not specified"),
        message:        escapeHtml(message),
    };

    try {
        await resend.emails.send({
            from:    "Good Ereseh <art@goodereseh.com>",
            to:      process.env.OWNER_EMAIL,
            replyTo: email,
            subject: `Commission Enquiry — ${safe.commissionType} — ${safe.name}`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f1ec;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr>
    <td style="background:#0f0d0b;padding:36px 48px;text-align:center;">
      <div style="font-family:Georgia,serif;font-size:28px;font-weight:300;color:#f0e8d8;letter-spacing:0.12em;">G &middot; E</div>
      <div style="font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:#5c5449;margin-top:6px;">Good Ereseh</div>
    </td>
  </tr>

  <tr>
    <td style="background:#1a1612;padding:18px 48px;text-align:center;border-bottom:1px solid #2c271f;">
      <div style="font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#8c8278;">New Commission Enquiry</div>
    </td>
  </tr>

  <tr>
    <td style="background:#0f0d0b;padding:40px 48px;">
      <div style="font-size:8px;letter-spacing:0.28em;text-transform:uppercase;color:#5c5449;margin-bottom:16px;">Commission Details</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #1a1612;width:40%;">
            <span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#5c5449;">Name</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #1a1612;text-align:right;">
            <span style="font-size:13px;color:#e4dbd0;">${safe.name}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #1a1612;">
            <span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#5c5449;">Email</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #1a1612;text-align:right;">
            <a href="mailto:${safe.email}" style="font-size:13px;color:#8c8278;text-decoration:none;">${safe.email}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #1a1612;">
            <span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#5c5449;">Type</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #1a1612;text-align:right;">
            <span style="font-size:13px;color:#e4dbd0;">${safe.commissionType}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #1a1612;">
            <span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#5c5449;">Size</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #1a1612;text-align:right;">
            <span style="font-size:13px;color:#e4dbd0;">${safe.size}</span>
          </td>
        </tr>
      </table>

      <div style="height:1px;background:#1a1612;margin:28px 0;"></div>
      <div style="font-size:8px;letter-spacing:0.28em;text-transform:uppercase;color:#5c5449;margin-bottom:14px;">Their Story</div>
      <div style="font-size:14px;color:#8c8278;line-height:1.85;white-space:pre-line;">${safe.message}</div>

      <div style="height:1px;background:#1a1612;margin:28px 0;"></div>
      <div style="font-size:11px;color:#3d3830;">Reply directly to this email to respond to ${safe.name}.</div>
    </td>
  </tr>

  <tr>
    <td style="background:#181512;padding:24px 48px;text-align:center;border-top:1px solid #2c271f;">
      <div style="font-size:9px;letter-spacing:0.15em;color:#3d3830;">Good Ereseh &middot; art@goodereseh.com &middot; goodereseh.com</div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`,
        });

        res.json({ success: true });
    } catch (err) {
        console.error("Commission form error:", err);
        res.status(500).json({ error: "Failed to send enquiry. Please email art@goodereseh.com directly." });
    }
});

module.exports = router;
