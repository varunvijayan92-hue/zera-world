import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

// Vercel must receive private runtime configuration through its environment settings.
// Never print values and never silently deploy a login flow without a signing key.
if (process.env.VERCEL === "1") {
  const missing = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) missing.push("JWT_SECRET (at least 32 characters)");
  if (Buffer.from(process.env.INTEGRATION_ENCRYPTION_KEY || "", "base64").length !== 32) missing.push("INTEGRATION_ENCRYPTION_KEY (base64 encoded 32-byte key)");
  if (missing.length) {
    console.error(`Production configuration is incomplete. Set these Vercel Production environment variables and redeploy: ${missing.join(", ")}`);
    process.exitCode = 1;
  } else console.log("Production environment prerequisites verified.");
}
