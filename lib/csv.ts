// Minimal, robust CSV parsing for the migration/import feature. Handles quoted
// fields, escaped quotes and CRLF. Used to import clients/guests exported from
// Aisle Planner, HoneyBook, Dubsado, Google Sheets, etc.

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

// Convert rows to objects keyed by lower-cased header.
export function toObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
}

// Pick the first present value among candidate header names.
export function pick(o: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = o[k.toLowerCase()];
    if (v != null && v !== "") return v;
  }
  return "";
}

// Best-effort date normaliser → yyyy-mm-dd (accepts ISO, dd/mm/yyyy, mm/dd/yyyy).
export function normaliseDate(s: string): string {
  if (!s) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s.trim());
  if (dmy) {
    let [, a, b, y] = dmy;
    if (y.length === 2) y = "20" + y;
    // assume dd/mm/yyyy (UK); if first > 12 it must be day
    const day = a.padStart(2, "0");
    const month = b.padStart(2, "0");
    return `${y}-${month}-${day}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
