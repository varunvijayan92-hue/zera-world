import { z } from "zod";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export function mobileListQuery(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(["page", "limit"].flatMap(key => url.searchParams.has(key) ? [[key, url.searchParams.get(key)]] : [])));
  if (!parsed.success) throw new Error("page must be 1–100000 and limit must be 1–200.");
  return { ...parsed.data, skip: (parsed.data.page - 1) * parsed.data.limit };
}

// A full page may have a following page. Stop when a page is shorter than limit.
export function mobileListMeta(data: unknown, page: number, limit: number) {
  if (Array.isArray(data)) return { page, limit, hasMore: data.length === limit };
  if (data && typeof data === "object") {
    const lists = Object.entries(data).filter(([, value]) => Array.isArray(value));
    if (lists.length) return { page, limit, collections: Object.fromEntries(lists.map(([key, value]) => [key, { hasMore: (value as unknown[]).length === limit }])) };
  }
  return undefined;
}
