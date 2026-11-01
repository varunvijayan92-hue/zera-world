import { Resend } from "resend";

type EmailMessage = { to: string; subject: string; text: string; replyTo?: string };
export const emailDelivery = {
  async send(message: EmailMessage, idempotencyKey: string) {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!key || !from) throw new Error("Email delivery is not configured.");
    const result = await new Resend(key).emails.send({ from, ...message }, { idempotencyKey });
    if (result.error || !result.data?.id) throw new Error("Email could not be sent. Please try again later.");
    return result.data.id;
  },
};
