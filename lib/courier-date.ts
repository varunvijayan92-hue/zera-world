// Shiprocket sends Indian local dates in both year-first and day-first formats.
export function courierDate(value: string | null | undefined) {
  if (!value) return null;
  const input = value.trim();
  const dayFirst = /^(\d{2})[ /-](\d{2})[ /-](\d{4})[ T](\d{2}:\d{2}:\d{2})$/.exec(input);
  const local = dayFirst ? `${dayFirst[3]}-${dayFirst[2]}-${dayFirst[1]}T${dayFirst[4]}` : input.replace(" ", "T");
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(local) ? `${local}+05:30` : local;
  const result = new Date(normalized);
  return Number.isFinite(result.getTime()) ? result : null;
}
