import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { contactSchema } from "@/lib/contact";
import { isSameOriginRequest } from "@/lib/request-origin";
import { rateLimited } from "@/lib/rate-limit";
import { emailDelivery } from "@/lib/email";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  if (Number(request.headers.get("content-length")) > 20000) return NextResponse.json({ message: "Your message is too long." }, { status: 413 });
  if (rateLimited(request, "contact", 5)) return NextResponse.json({ message: "Too many messages. Please try again later." }, { status: 429 });
  let body: unknown;
  try { const raw = await request.text(); if (Buffer.byteLength(raw) > 20000) return NextResponse.json({ message: "Your message is too long." }, { status: 413 }); body = JSON.parse(raw); }
  catch { return NextResponse.json({ message: "Check the contact form details." }, { status: 400 }); }
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message || "Check the contact form details." }, { status: 400 });
  if (parsed.data.website) return NextResponse.json({ message: "Message received." });
  const reference = `CONTACT-${randomUUID()}`;
  try {
    const { website, ...details } = parsed.data;
    await prisma.auditLog.create({ data: { action: "CONTACT_REQUEST", entityType: "ContactMessage", entityId: reference, details } });
    try {
      await emailDelivery.send({ to: process.env.SUPPORT_EMAIL || "support@zerasworld.in", replyTo: details.email, subject: `Customer enquiry: ${details.subject}`, text: `Reference: ${reference}\nName: ${details.fullName}\nEmail: ${details.email}\nOrder: ${details.orderNumber || "Not provided"}\n\n${details.message}` }, `contact/${reference}`);
    } catch {
      return NextResponse.json({ message: "Your enquiry is saved in our support inbox, but the email notification could not be sent.", reference }, { status: 201 });
    }
    return NextResponse.json({ message: "Your message has been received by Zera's World support.", reference }, { status: 201 });
  } catch { return NextResponse.json({ message: "Your message could not be saved. Please try again later." }, { status: 503 }); }
}
