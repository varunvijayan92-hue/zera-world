// Per-instance guard; use a shared rate limiter at the deployment edge as well.
const attempts = new Map<string, { count: number; until: number }>();
export function rateLimited(request: Request, bucket: string, max = 20, windowMs = 600000) {
  const key = `${bucket}:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"}`;
  const now = Date.now();
  if (attempts.size > 10000) for (const [id, value] of attempts) if (value.until < now) attempts.delete(id);
  const entry = attempts.get(key);
  if (!entry || entry.until <= now) { attempts.set(key, { count: 1, until: now + windowMs }); return false; }
  entry.count++; return entry.count > max;
}
