import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey() {
  const key = Buffer.from(process.env.INTEGRATION_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32) throw Error("Set INTEGRATION_ENCRYPTION_KEY to a base64 encoded 32 byte key on the server.");
  return key;
}
export function encryptCredentials(value: Record<string, string>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}
export function decryptCredentials(value: string): Record<string, string> {
  const [version, iv, tag, data] = value.split(".");
  if (version !== "v1") throw Error("Unsupported credential format.");
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  cipher.setAuthTag(Buffer.from(tag, "base64"));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(data, "base64")), cipher.final()]).toString("utf8"));
}
