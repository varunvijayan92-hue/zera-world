import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const prisma = new PrismaClient({ log: [] });
const quote = (value) => `"${value.replaceAll('"', '""')}"`;
try {
  const snapshot = await prisma.$transaction(async (tx) => {
    const names = await tx.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name");
    const dependencies = await tx.$queryRawUnsafe("SELECT child.relname AS child, parent.relname AS parent FROM pg_constraint c JOIN pg_class child ON child.oid = c.conrelid JOIN pg_class parent ON parent.oid = c.confrelid JOIN pg_namespace n ON n.oid = child.relnamespace WHERE c.contype = 'f' AND n.nspname = 'public'");
    const tables = [];
    for (const { table_name: name } of names) {
      const rows = await tx.$queryRawUnsafe(`SELECT row_to_json(t)::text AS row FROM public.${quote(name)} t`);
      tables.push({ name, rows: rows.map((entry) => entry.row) });
    }
    return { capturedAt: new Date().toISOString(), dependencies, tables };
  }, { isolationLevel: "RepeatableRead", timeout: 120000 });
  const directory = resolve(".backups", snapshot.capturedAt.replace(/[:.]/g, "-"));
  await mkdir(directory, { recursive: true });
  const data = JSON.stringify(snapshot);
  await writeFile(resolve(directory, "data.json"), data, { mode: 0o600 });
  const remaining = new Map(snapshot.tables.map((table) => [table.name, table]));
  const ordered = [];
  while (remaining.size) {
    const ready = [...remaining.values()].filter((table) => !snapshot.dependencies.some((edge) => edge.child === table.name && edge.parent !== table.name && remaining.has(edge.parent)));
    if (!ready.length) throw Error("Cyclic foreign keys require manual restore planning; the JSON snapshot is saved.");
    for (const table of ready) { ordered.push(table); remaining.delete(table.name); }
  }
  const statements = ["-- Restore only into an empty database with the matching schema. Contains private data.", "BEGIN;"];
  for (const table of ordered) for (const row of table.rows) statements.push(`INSERT INTO public.${quote(table.name)} SELECT * FROM json_populate_record(NULL::public.${quote(table.name)}, '${row.replaceAll("'", "''")}'::json);`);
  statements.push("COMMIT;");
  await writeFile(resolve(directory, "data.sql"), statements.join("\n"), { mode: 0o600 });
  const manifest = { directory, tables: snapshot.tables.length, rows: snapshot.tables.reduce((sum, table) => sum + table.rows.length, 0), sha256: createHash("sha256").update(data).digest("hex") };
  await writeFile(resolve(directory, "manifest.json"), JSON.stringify(manifest, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(manifest));
} catch (error) {
  console.error(JSON.stringify({ message: "Database backup failed; no schema update should be applied.", code: error.code || error.name }));
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
