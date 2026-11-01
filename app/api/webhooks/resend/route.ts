
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INBOUND =
  process.env.RESEND_INBOUND_ADDRESS ??
  "support@support.zerasworld.in";

const FORWARD_TO =
  process.env.RESEND_FORWARD_TO ??
  "supportzerasworld@gmail.com";

const FORWARD_FROM =
  process.env.RESEND_FORWARD_FROM ??
  "forwarder@support.zerasworld.in";

function emailAddress(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim().toLowerCase();
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  if (!apiKey || !webhookSecret) {
    console.error("Resend configuration is missing");
    return new Response("Configuration error", { status: 500 });
  }

  const resend = new Resend(apiKey);

  // Verify the original request, not re-serialized JSON.
  let event;

  try {
    const payload = await request.text();

    event = resend.webhooks.verify({
      payload,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret,
    });
  } catch {
    return new Response("Invalid webhook signature", {
      status: 400,
    });
  }

  if (event.type !== "email.received") {
    return Response.json({ ok: true, ignored: true });
  }

  const { email_id, from, to } = event.data;

  // Forward only emails sent to this specific address.
  const isSupportMail = to.some(
    (address: string) => emailAddress(address) ===
      INBOUND.toLowerCase()
  );

  if (!isSupportMail) {
    return Response.json({ ok: true, ignored: true });
  }

  // Basic forwarding-loop protection.
  const sender = emailAddress(from);

  if (
    sender === emailAddress(FORWARD_FROM) ||
    sender === emailAddress(FORWARD_TO) ||
    sender === emailAddress(INBOUND)
  ) {
    return Response.json({ ok: true, ignored: true });
  }

  try {
    // The webhook contains metadata, not the email body.
    const { data: email, error: readError } =
      await resend.emails.receiving.get(email_id);

    if (readError || !email) {
      throw new Error("Failed to retrieve received email");
    }

    const { data: attachmentList, error: attachmentError } =
      await resend.emails.receiving.attachments.list({
        emailId: email_id,
      });

    if (attachmentError || !attachmentList) {
      throw new Error("Failed to list attachments");
    }

    // Limit attachment size to avoid Vercel memory and
    // Resend message-size problems.
    const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
    const totalSize = attachmentList.data.reduce(
      (sum, attachment) => sum + (attachment.size ?? 0),
      0
    );

    if (totalSize > MAX_TOTAL_BYTES) {
      throw new Error("Attachments exceed forwarding limit");
    }

    const attachments = [];

    for (const attachment of attachmentList.data) {
      const response = await fetch(attachment.download_url);

      if (!response.ok) {
        throw new Error("Attachment download failed");
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      attachments.push({
        filename: attachment.filename,
        content: buffer.toString("base64"),
      });
    }

    const originalSender = emailAddress(email.from);
    const body =
      email.text ||
      "This message contained HTML content only. " +
        "View the original email in Resend.";

    const forwardedText = [
      "Forwarded customer support email",
      "",
      `From: ${email.from}`,
      `To: ${email.to.join(", ")}`,
      `Subject: ${email.subject ?? "(No subject)"}`,
      "",
      "----- ORIGINAL MESSAGE -----",
      body,
    ].join("\n");

    const { error: sendError } = await resend.emails.send(
      {
        from: `Zera's World Support <${FORWARD_FROM}>`,
        to: [FORWARD_TO],
        replyTo: originalSender,
        subject: `Fwd: ${email.subject || "(No subject)"}`,
        text: forwardedText,
        attachments,
      },
      {
        idempotencyKey: `support-forward/${email_id}`,
      }
    );

    if (sendError) {
      throw new Error("Resend forwarding failed");
    }

    return Response.json({ ok: true, forwarded: true });
  } catch (error) {
    console.error("Support email forwarding failed", error);

    // Non-2xx response lets Resend retry failed webhook delivery.
    return new Response("Forwarding failed", { status: 500 });
  }
}
