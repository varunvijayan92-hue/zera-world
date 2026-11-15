import { createHash } from "node:crypto";
import { z } from "zod";
import { integrationCredentials } from "./integration-settings";
import { AccessError } from "./portal-access";

export const whatsappMessageSchema = z.object({
  submissionId: z.string().uuid(),
  phoneNumberId: z.string().regex(/^\d{5,30}$/).optional(),
  messageId: z.coerce.string().regex(/^\d{1,20}$/),
  to: z.string().trim().transform(value => value.replace(/^\+/, "").replace(/^91(?=\d{10}$)/, ""))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "Use a valid 10-digit Indian recipient number, optionally prefixed with +91.")),
  variables: z.array(z.string().max(1024).refine(value => !value.includes("|"), "Template values cannot contain a pipe character.")).max(30).default([]),
  mediaUrl: z.string().url().refine(value => new URL(value).protocol === "https:", "Use an HTTPS media URL.").optional(),
  documentFilename: z.string().trim().min(1).max(100).regex(/^[\p{L}\p{N} ._-]+$/u).optional(),
}).strict();
export type WhatsAppMessage = z.infer<typeof whatsappMessageSchema>;
export type WhatsAppNumber = { phoneNumberId: string; name: string; connectionStatus: string; templates: WhatsAppTemplate[] };
export type WhatsAppTemplate = { messageId: string; name: string; status: string; variableCount: number; mediaType: string | null };

export const whatsappTransport = { fetch: (...args: Parameters<typeof fetch>) => fetch(...args) };
export const whatsappConfiguration = {
  async read() {
    const saved = await integrationCredentials("FAST2SMS_WHATSAPP");
    return { apiKey: saved.apiKey || process.env.FAST2SMS_API_KEY || "", phoneNumberId: saved.phoneNumberId || process.env.FAST2SMS_WHATSAPP_PHONE_NUMBER_ID || "" };
  },
};

async function providerRequest(path: string, params: URLSearchParams, sending = false) {
  const { apiKey } = await whatsappConfiguration.read();
  if (!apiKey) throw new AccessError("Configure the Fast2SMS API key on the server first.", 503);
  let response: Response;
  try {
    response = await whatsappTransport.fetch(`https://www.fast2sms.com/dev/${path}?${params}`, {
      headers: { Authorization: apiKey, Accept: "application/json" },
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new AccessError(sending ? "Send status is unknown. Check Fast2SMS message logs before trying another submission." : "Fast2SMS could not be reached. Try again later.", 502);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false || body?.status === false || body?.return === false || !body) {
    if ([412, 413].includes(Number(body?.status_code)) || response.status === 401) throw new AccessError("Fast2SMS rejected the API key. Check that the key is enabled and the server IP is allowed.", 502);
    throw new AccessError(sending ? "Fast2SMS did not confirm acceptance. Check message logs before retrying." : "Fast2SMS rejected the WhatsApp lookup. Check account setup and API access.", 502);
  }
  return body;
}

export function parseWhatsAppNumbers(value: unknown): WhatsAppNumber[] {
  const rows = value && typeof value === "object" && "data" in value && Array.isArray(value.data) ? value.data : [];
  return rows.map((row: any) => ({
    phoneNumberId: String(row.phone_number_id || ""), name: String(row.verified_name || ""), connectionStatus: String(row.connection_status || "UNKNOWN"),
    templates: (Array.isArray(row.templates) ? row.templates : []).map((template: any) => ({
      messageId: String(template.message_id || ""), name: String(template.template_name || ""), status: String(template.status || "UNKNOWN"),
      variableCount: Number(template.var_count || 0),
      mediaType: (Array.isArray(template.components) ? template.components : []).find((component: any) => component.type === "HEADER" && ["IMAGE", "VIDEO", "DOCUMENT"].includes(component.format))?.format || null,
    })),
  }));
}

export async function whatsappMetadata() {
  const configuration = await whatsappConfiguration.read();
  if (!configuration.apiKey) return { configured: false, phoneNumberId: configuration.phoneNumberId, numbers: [] as WhatsAppNumber[], approvedTemplates: 0 };
  const numbers = parseWhatsAppNumbers(await providerRequest("dlt_manager/whatsapp", new URLSearchParams({ type: "template" })));
  return { configured: true, phoneNumberId: configuration.phoneNumberId, numbers,
    approvedTemplates: numbers.reduce((count, number) => count + number.templates.filter(template => template.status.toUpperCase() === "APPROVED").length, 0) };
}

export async function prepareWhatsAppMessage(input: WhatsAppMessage) {
  const metadata = await whatsappMetadata();
  if (!metadata.configured) throw new AccessError("Configure the Fast2SMS API key first.", 503);
  const phoneNumberId = input.phoneNumberId || metadata.phoneNumberId;
  const number = metadata.numbers.find(item => item.phoneNumberId === phoneNumberId);
  if (!number || number.connectionStatus.toUpperCase() !== "CONNECTED") throw new AccessError("Select a connected WhatsApp sender from the account.", 409);
  const template = number.templates.find(item => item.messageId === input.messageId);
  if (!template || template.status.toUpperCase() !== "APPROVED") throw new AccessError("This WhatsApp template is not approved. Wait for approval in Fast2SMS before sending.", 409);
  if (input.variables.length !== template.variableCount) throw new AccessError(`This template requires ${template.variableCount} variable value(s).`);
  if (template.mediaType && !input.mediaUrl) throw new AccessError("This template requires an HTTPS media URL.");
  if (!template.mediaType && input.mediaUrl) throw new AccessError("This template does not have a media header.");
  if (input.documentFilename && template.mediaType !== "DOCUMENT") throw new AccessError("A document filename is only valid for a document template.");
  const message = { ...input, phoneNumberId };
  const fingerprint = createHash("sha256").update(JSON.stringify({ ...message, submissionId: undefined })).digest("hex");
  return { message, fingerprint };
}

export async function sendWhatsAppMessage(input: WhatsAppMessage & { phoneNumberId: string }) {
  const params = new URLSearchParams({ phone_number_id: input.phoneNumberId, message_id: input.messageId, numbers: input.to, udf1: input.submissionId });
  if (input.variables.length) params.set("variables_values", input.variables.join("|"));
  if (input.mediaUrl) params.set("media_url", input.mediaUrl);
  if (input.documentFilename) params.set("document_filename", input.documentFilename);
  const result = await providerRequest("whatsapp", params, true);
  if (result.status !== true || typeof result.request_id !== "string" || !result.request_id) throw new AccessError("Send status is unknown. Check Fast2SMS message logs before trying another submission.", 502);
  return { requestId: result.request_id, status: "ACCEPTED" as const };
}
