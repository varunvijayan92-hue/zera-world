import { createHash } from "node:crypto";
import { z } from "zod";
import { integrationCredentials } from "./integration-settings";
import { AccessError } from "./portal-access";

export const whatsappMessageSchema = z.object({
  submissionId: z.string().uuid(),
  phoneNumberId: z.string().regex(/^\d{5,30}$/).optional(),
  messageId: z.coerce.string().regex(/^[a-z0-9_]{1,512}$/),
  language: z.string().regex(/^[a-z]{2,3}(?:_[A-Z]{2})?$/).optional(),
  to: z.string().trim().transform(value => value.replace(/^\+/, "").replace(/^91(?=\d{10}$)/, ""))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "Use a valid 10-digit Indian recipient number, optionally prefixed with +91.")),
  variables: z.array(z.string().max(1024).refine(value => !value.includes("|"), "Template values cannot contain a pipe character.")).max(30).default([]),
  mediaUrl: z.string().url().refine(value => new URL(value).protocol === "https:", "Use an HTTPS media URL.").optional(),
  documentFilename: z.string().trim().min(1).max(100).regex(/^[\p{L}\p{N} ._-]+$/u).optional(),
}).strict();
export type WhatsAppMessage = z.infer<typeof whatsappMessageSchema>;
export type WhatsAppNumber = { phoneNumberId: string; name: string; connectionStatus: string; templates: WhatsAppTemplate[] };
export type WhatsAppTemplate = {
  messageId: string; name: string; language: string; status: string; variableCount: number;
  mediaType: string | null; body: string; examples: string[]; supported: boolean;
};

type MetaComponent = { type: string; format?: string; text?: string; example?: { body_text?: string[][] }; buttons?: { type: string; url?: string }[] };
type MetaTemplate = { id: string; name: string; language: string; status: string; parameter_format?: string; components?: MetaComponent[] };
type MetaPage<T> = { data: T[]; paging?: { next?: string; cursors?: { after?: string } } };

export const whatsappTransport = { fetch: (...args: Parameters<typeof fetch>) => fetch(...args) };
export const whatsappConfiguration = {
  async read() {
    const saved = await integrationCredentials("META_WHATSAPP");
    return { accessToken: saved.accessToken, wabaId: saved.wabaId, phoneNumberId: saved.phoneNumberId };
  },
};

async function metaRequest<T>(accessToken: string, path: string, payload?: object): Promise<T> {
  let response: Response;
  try {
    response = await whatsappTransport.fetch(`https://graph.facebook.com/v27.0/${path}`, {
      method: payload ? "POST" : "GET",
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", ...(payload && { "Content-Type": "application/json" }) },
      body: payload ? JSON.stringify(payload) : undefined,
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new AccessError(payload ? "Send status is unknown. Check Meta WhatsApp Manager before trying again." : "Meta could not be reached. Try again later.", 502);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || body.error) {
    throw new AccessError(payload ? "Meta did not confirm acceptance. Check Meta WhatsApp Manager before retrying." : "Meta rejected the lookup. Check the IDs, token permissions and account access.", 502);
  }
  return body;
}

async function listMetaAssets<T>(accessToken: string, path: string, fields: string) {
  const rows: T[] = [];
  const cursors = new Set<string>();
  const query = new URLSearchParams({ fields, limit: "100" });
  while (true) {
    const page = await metaRequest<MetaPage<T>>(accessToken, `${path}?${query}`);
    if (!Array.isArray(page.data)) throw new AccessError("Meta returned an invalid account response.", 502);
    rows.push(...page.data);
    if (!page.paging?.next) return rows;
    const cursor = page.paging.cursors?.after;
    if (!cursor || cursors.has(cursor)) throw new AccessError("Meta returned an invalid pagination cursor.", 502);
    cursors.add(cursor);
    query.set("after", cursor);
  }
}

export function parseWhatsAppTemplate(row: MetaTemplate): WhatsAppTemplate {
  const components = row.components || [];
  const body = components.find(component => component.type === "BODY");
  const header = components.find(component => component.type === "HEADER");
  const text = body?.text || "";
  const placeholders = [...text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map(match => Number(match[1]));
  const mediaType = header?.format && ["IMAGE", "VIDEO", "DOCUMENT"].includes(header.format) ? header.format : null;
  return {
    messageId: row.id, name: row.name, language: row.language, status: row.status,
    variableCount: Math.max(0, ...placeholders), mediaType, body: text, examples: body?.example?.body_text?.[0] || [],
    supported: row.parameter_format !== "NAMED"
      && (!header || mediaType !== null || (header.format === "TEXT" && !header.text?.includes("{{")))
      && components.every(component => ["BODY", "HEADER", "FOOTER", "BUTTONS"].includes(component.type)
        && (component.buttons || []).every(button => ["QUICK_REPLY", "PHONE_NUMBER", "URL"].includes(button.type) && !button.url?.includes("{{"))),
  };
}

export async function whatsappMetadata() {
  const { accessToken, wabaId, phoneNumberId } = await whatsappConfiguration.read();
  if (!accessToken || !wabaId || !phoneNumberId) return { configured: false, phoneNumberId: phoneNumberId || "", numbers: [] as WhatsAppNumber[], approvedTemplates: 0 };
  if (![wabaId, phoneNumberId].every(id => /^\d{5,30}$/.test(id))) throw new AccessError("Check the Meta account and phone number IDs.", 503);
  const [phones, rows] = await Promise.all([
    listMetaAssets<{ id: string; verified_name: string; status: string }>(accessToken, `${wabaId}/phone_numbers`, "id,verified_name,status"),
    listMetaAssets<MetaTemplate>(accessToken, `${wabaId}/message_templates`, "id,name,language,status,parameter_format,components"),
  ]);
  const phone = phones.find(item => item.id === phoneNumberId);
  if (!phone) throw new AccessError("The phone number ID is not in the configured WhatsApp Business Account.", 409);
  const templates = rows.map(parseWhatsAppTemplate);
  return { configured: true, phoneNumberId, numbers: [{ phoneNumberId, name: phone.verified_name, connectionStatus: phone.status || "UNKNOWN", templates }],
    approvedTemplates: templates.filter(template => template.status === "APPROVED").length };
}

type PreparedMessage = WhatsAppMessage & { phoneNumberId: string; templateName: string; templateLanguage: string; mediaType: string | null };

export async function prepareWhatsAppMessage(input: WhatsAppMessage) {
  const metadata = await whatsappMetadata();
  if (!metadata.configured) throw new AccessError("Save the Meta access token, account ID and phone number ID in Admin Settings.", 503);
  const phoneNumberId = input.phoneNumberId || metadata.phoneNumberId;
  const number = metadata.numbers.find(item => item.phoneNumberId === phoneNumberId);
  if (!number || number.connectionStatus !== "CONNECTED") throw new AccessError("Select a connected WhatsApp sender from the Meta account.", 409);
  const candidates = number.templates.filter(item => (item.messageId === input.messageId || item.name === input.messageId)
    && (!input.language || item.language === input.language) && item.status === "APPROVED");
  if (candidates.length > 1) throw new AccessError("Set the template language in Admin Settings.", 409);
  const [template] = candidates;
  if (!template) throw new AccessError("This WhatsApp template is not approved or could not be found in Meta.", 409);
  if (!template.supported) throw new AccessError("This template uses components the store does not support.", 409);
  if (input.variables.length !== template.variableCount) throw new AccessError(`This template requires ${template.variableCount} variable value(s).`);
  if (template.mediaType && !input.mediaUrl) throw new AccessError("This template requires an HTTPS media URL.");
  if (!template.mediaType && input.mediaUrl) throw new AccessError("This template does not have a media header.");
  if (input.documentFilename && template.mediaType !== "DOCUMENT") throw new AccessError("A document filename is only valid for a document template.");
  const message: PreparedMessage = { ...input, phoneNumberId, templateName: template.name, templateLanguage: template.language, mediaType: template.mediaType };
  const fingerprint = createHash("sha256").update(JSON.stringify({ ...message, submissionId: undefined })).digest("hex");
  return { message, fingerprint };
}

export async function sendWhatsAppMessage(input: PreparedMessage) {
  const { accessToken, phoneNumberId } = await whatsappConfiguration.read();
  if (!accessToken || phoneNumberId !== input.phoneNumberId) throw new AccessError("The Meta sender configuration changed. Reload your settings.", 409);
  const components = [];
  if (input.mediaType && input.mediaUrl) {
    const type = input.mediaType.toLowerCase();
    components.push({ type: "header", parameters: [{ type, [type]: { link: input.mediaUrl, ...(input.documentFilename && { filename: input.documentFilename }) } }] });
  }
  if (input.variables.length) components.push({ type: "body", parameters: input.variables.map(text => ({ type: "text", text })) });
  const result = await metaRequest<{ messages?: { id?: string }[] }>(accessToken, `${phoneNumberId}/messages`, {
    messaging_product: "whatsapp", to: `91${input.to}`, type: "template", biz_opaque_callback_data: input.submissionId,
    template: { name: input.templateName, language: { code: input.templateLanguage }, ...(components.length && { components }) },
  });
  const requestId = result.messages?.[0]?.id;
  if (!requestId) throw new AccessError("Send status is unknown. Check Meta WhatsApp Manager before trying again.", 502);
  return { requestId, status: "ACCEPTED" as const };
}

export async function sendWhatsAppText(senderId: string, to: string, body: string) {
  const { accessToken, phoneNumberId } = await whatsappConfiguration.read();
  if (!accessToken || phoneNumberId !== senderId || !/^\d{5,30}$/.test(senderId)) {
    throw new AccessError("Configure the Meta sender used for this conversation in Admin Settings.", 503);
  }
  const result = await metaRequest<{ messages?: { id?: string }[] }>(accessToken, `${senderId}/messages`, {
    messaging_product: "whatsapp", to, type: "text", text: { body },
  });
  const id = result.messages?.[0]?.id;
  if (!id) throw new AccessError("Meta did not confirm the reply. Check the conversation before retrying.", 502);
  return id;
}
