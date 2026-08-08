const { Resend } = require("resend");
const dotenv = require("dotenv");
const path = require("path");

// Same dotenv config as before — keeps local dev working
dotenv.config({
    path: path.resolve(__dirname, "../.env"),
});

const resend = new Resend(process.env.RESEND_API_KEY);

// ── Helpers ─────────────────────────────────────────────────────────────────

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

// Email clients have no base URL — relative paths show broken images.
// Convert /images/artwork/eye.jpg → https://goodereseh.com/images/artwork/eye.jpg
function absoluteImageUrl(path) {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    return `https://goodereseh.com${path}`;
}

// ── Main function ────────────────────────────────────────────────────────────

async function sendOrderEmails(order) {
    const safe = {
        name:    escapeHtml(order.name),
        email:   escapeHtml(order.email),
        phone:   escapeHtml(order.phone)   || "Not provided",
        artwork: escapeHtml(order.artwork),
        type:    escapeHtml(order.type),
        price:   escapeHtml(String(order.price)),
        address: escapeHtml(order.address) || "Provided at Stripe checkout",
        // NOTE: do NOT escapeHtml the image — it's a URL used in src="..."
        // absoluteImageUrl makes it work in email clients
        image:   absoluteImageUrl(order.image),
    };

    // ── OWNER NOTIFICATION ───────────────────────────────────────────────────
    const ownerEmail = resend.emails.send({
        from:    "Good Ereseh <art@goodereseh.com>",
        to:      process.env.OWNER_EMAIL,
        replyTo: order.email,
        subject: `New Order — ${safe.artwork} (${safe.type})`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f1ec;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr>
    <td style="background:#0f0d0b;padding:36px 48px;text-align:center;">
      <div style="font-family:Georgia,serif;font-size:28px;font-weight:300;color:#f0e8d8;letter-spacing:0.12em;">G &middot; E</div>
      <div style="font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:#5c5449;margin-top:6px;">Good Ereseh</div>
    </td>
  </tr>

  <!-- Alert banner -->
  <tr>
    <td style="background:#1a1612;padding:18px 48px;text-align:center;border-bottom:1px solid #2c271f;">
      <div style="font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#8c8278;">New Artwork Order Received</div>
    </td>
  </tr>

  <!-- Artwork image (absolute URL so it loads in Gmail/Outlook/Apple Mail) -->
  ${safe.image ? `
  <tr>
    <td style="background:#0f0d0b;padding:0;line-height:0;">
      <img src="${safe.image}" alt="${safe.artwork}" width="600"
        style="display:block;width:100%;max-height:340px;object-fit:cover;border:0;"/>
    </td>
  </tr>` : ""}

  <!-- Artwork details -->
  <tr>
    <td style="background:#0f0d0b;padding:32px 48px 0;">
      <div style="font-size:8px;letter-spacing:0.28em;text-transform:uppercase;color:#5c5449;margin-bottom:16px;">Artwork Details</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #1a1612;">
            <span style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#5c5449;">Artwork</span>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #1a1612;text-align:right;">
            <span style="font-family:Georgia,serif;font-size:18px;font-weight:300;color:#f0e8d8;">${safe.artwork}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #1a1612;">
            <span style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#5c5449;">Type</span>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #1a1612;text-align:right;">
            <span style="font-size:13px;color:#bdb3a8;">${safe.type}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 0 0;">
            <span style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#5c5449;">Amount</span>
          </td>
          <td style="padding:16px 0 0;text-align:right;">
            <span style="font-family:Georgia,serif;font-size:26px;font-weight:300;color:#f0e8d8;">&pound;${safe.price}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Divider -->
  <tr>
    <td style="background:#0f0d0b;padding:32px 48px;">
      <div style="height:1px;background:#1a1612;"></div>
    </td>
  </tr>

  <!-- Customer details -->
  <tr>
    <td style="background:#0f0d0b;padding:0 48px 40px;">
      <div style="font-size:8px;letter-spacing:0.28em;text-transform:uppercase;color:#5c5449;margin-bottom:16px;">Customer Details</div>
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
            <span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#5c5449;">Phone</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #1a1612;text-align:right;">
            <span style="font-size:13px;color:#e4dbd0;">${safe.phone}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;">
            <span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#5c5449;">Address</span>
          </td>
          <td style="padding:10px 0;text-align:right;">
            <span style="font-size:13px;color:#e4dbd0;line-height:1.6;">${safe.address}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#181512;padding:24px 48px;text-align:center;border-top:1px solid #2c271f;">
      <div style="font-size:9px;letter-spacing:0.15em;color:#3d3830;">
        Good Ereseh &middot; art@goodereseh.com &middot; goodereseh.com
      </div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`,
    });

    // ── CUSTOMER CONFIRMATION ────────────────────────────────────────────────
    const customerEmail = resend.emails.send({
        from:    "Good Ereseh <art@goodereseh.com>",
        to:      order.email,
        subject: `Your order — ${safe.artwork} | Good Ereseh`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f1ec;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr>
    <td style="background:#0f0d0b;padding:36px 48px;text-align:center;">
      <div style="font-family:Georgia,serif;font-size:28px;font-weight:300;color:#f0e8d8;letter-spacing:0.12em;">G &middot; E</div>
      <div style="font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:#5c5449;margin-top:6px;">Good Ereseh</div>
    </td>
  </tr>

  <!-- Artwork image -->
  ${safe.image ? `
  <tr>
    <td style="background:#0f0d0b;padding:0;line-height:0;">
      <img src="${safe.image}" alt="${safe.artwork}" width="600"
        style="display:block;width:100%;max-height:300px;object-fit:cover;border:0;"/>
    </td>
  </tr>` : ""}

  <!-- Body -->
  <tr>
    <td style="background:#0f0d0b;padding:40px 48px;">
      <div style="font-family:Georgia,serif;font-size:30px;font-weight:300;color:#f0e8d8;margin-bottom:16px;line-height:1.2;">
        Thank you, ${safe.name}.
      </div>
      <div style="font-size:14px;color:#8c8278;line-height:1.85;margin-bottom:32px;">
        Your payment has been received. Your artwork is being carefully prepared and will be dispatched with the attention it deserves.
      </div>

      <div style="height:1px;background:#1a1612;margin-bottom:24px;"></div>
      <div style="font-size:8px;letter-spacing:0.28em;text-transform:uppercase;color:#5c5449;margin-bottom:16px;">Your Order</div>

      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #1a1612;">
            <span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#5c5449;">Artwork</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #1a1612;text-align:right;">
            <span style="font-family:Georgia,serif;font-size:16px;font-weight:300;color:#f0e8d8;">${safe.artwork}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #1a1612;">
            <span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#5c5449;">Type</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #1a1612;text-align:right;">
            <span style="font-size:13px;color:#bdb3a8;">${safe.type}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0 0;">
            <span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#5c5449;">Amount Paid</span>
          </td>
          <td style="padding:14px 0 0;text-align:right;">
            <span style="font-family:Georgia,serif;font-size:22px;font-weight:300;color:#f0e8d8;">&pound;${safe.price}</span>
          </td>
        </tr>
      </table>

      <div style="height:1px;background:#1a1612;margin:28px 0;"></div>
      <div style="font-size:13px;color:#5c5449;line-height:1.85;">
        Questions about your order? Email
        <a href="mailto:art@goodereseh.com" style="color:#8c8278;text-decoration:none;">art@goodereseh.com</a>
        and quote your email address as reference.
      </div>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#181512;padding:24px 48px;text-align:center;border-top:1px solid #2c271f;">
      <div style="font-size:9px;letter-spacing:0.15em;color:#3d3830;">
        Good Ereseh &middot; London, UK &middot;
        <a href="https://goodereseh.com" style="color:#3d3830;text-decoration:none;">goodereseh.com</a>
      </div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`,
    });

    // ── Result handling (same as your working version) ───────────────────────
    const [ownerResult, customerResult] = await Promise.allSettled([
        ownerEmail,
        customerEmail,
    ]);

    const failures = [];

    if (ownerResult.status === "rejected") {
        console.error("Owner notification email failed:", ownerResult.reason);
        failures.push("owner");
    }

    if (customerResult.status === "rejected") {
        console.error("Customer confirmation email failed:", customerResult.reason);
        failures.push("customer");
    }

    if (failures.length > 0) {
        throw new Error(`Failed to send email(s) to: ${failures.join(", ")}`);
    }

    console.log("Order emails sent successfully");
}

module.exports = sendOrderEmails;
