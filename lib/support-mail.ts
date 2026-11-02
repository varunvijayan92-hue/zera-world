import { Resend } from "resend";

export const supportMailClient = {
  create: (apiKey: string) => new Resend(apiKey),
};
