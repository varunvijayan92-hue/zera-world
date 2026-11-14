import { test } from "node:test";
import { strict as assert } from "node:assert";
import { queuePaidCjOrder } from "../lib/cj-fulfilment-queue";
import type { Prisma } from "@prisma/client";

test("paid CJ orders get one deterministic queue key", async () => {
  const calls: { where: { id: string }; create: { metadata: unknown } }[] = [];
  const tx = { orderItem: { findFirst: async () => ({ id: "line" }) }, syncJob: { upsert: async (input: typeof calls[number]) => { calls.push(input); } } } as unknown as Prisma.TransactionClient;
  await queuePaidCjOrder(tx, "order1");
  await queuePaidCjOrder(tx, "order1");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].where.id, calls[1].where.id);
  assert.deepEqual(calls[0].create.metadata, { orderId: "order1" });
});

test("non-CJ orders do not create CJ jobs", async () => {
  let created = false;
  const tx = { orderItem: { findFirst: async () => null }, syncJob: { upsert: async () => { created = true; } } } as unknown as Prisma.TransactionClient;
  await queuePaidCjOrder(tx, "order1");
  assert.equal(created, false);
});
