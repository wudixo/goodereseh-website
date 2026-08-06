const { Resend } = require("resend");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({
    path: path.resolve(__dirname, "../.env"),
});

const resend = new Resend(process.env.RESEND_API_KEY);

// Basic HTML-escaping so order fields (which ultimately come from customer
// input at checkout) can't inject markup/HTML into emails we send.
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
        switch (char) {
            case "&":
                return "&amp;";
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case '"':
                return "&quot;";
            case "'":
                return "&#39;";
            default:
                return char;
        }
    });
}

async function sendOrderEmails(order) {
    const safe = {
        name: escapeHtml(order.name),
        email: escapeHtml(order.email),
        phone: escapeHtml(order.phone),
        artwork: escapeHtml(order.artwork),
        type: escapeHtml(order.type),
        price: escapeHtml(order.price),
        image: escapeHtml(order.image),
        address: escapeHtml(order.address),
    };

    const ownerEmail = resend.emails.send({
        from: "Good Ereseh <art@goodereseh.com>",
        to: process.env.OWNER_EMAIL,
        replyTo: order.email,
        subject: `New Artwork Order | ${safe.artwork}`,
        html: `
            <h2>New Artwork Order Received</h2>

            <h3>Customer Details</h3>
            <p><strong>Name:</strong> ${safe.name}</p>
            <p><strong>Email:</strong> ${safe.email}</p>
            <p><strong>Phone:</strong> ${safe.phone}</p>

            <h3>Artwork Details</h3>
            <p><strong>Artwork:</strong> ${safe.artwork}</p>
            <strong>Artwork Image:</strong><br>
<img src="${safe.image}" width="300">
</p>
            <p><strong>Type:</strong> ${safe.type}</p>
            <p><strong>Amount:</strong> £${safe.price}</p>
            

            <h3>Shipping Address</h3>
            <p>${safe.address}</p>
        `,
    });

    const customerEmail = resend.emails.send({
        from: "Good Ereseh <art@goodereseh.com>",
        to: order.email,
        subject: "Thank you for your artwork purchase | Good Ereseh",
        html: `
            <h2>Thank you for your purchase</h2>
            <p>Dear ${safe.name},</p>
            <p>Your payment has been received successfully.</p>
            <p><strong>Artwork:</strong> ${safe.artwork}</p>
            <p><strong>Amount:</strong> £${safe.price}</p>
            <p>We will contact you shortly regarding delivery.</p>
            <p>Thank you for supporting original art.</p>
            <p>Good Ereseh</p>
        `,
    });

    // Send both independently so one failing doesn't stop/hide the other.
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
        // Rethrow so the caller (webhook handler) actually knows something
        // failed, instead of silently swallowing it here.
        throw new Error(`Failed to send email(s) to: ${failures.join(", ")}`);
    }

    console.log("Order emails sent successfully");
}

module.exports = sendOrderEmails;