// sheets.js — načtení Google Sheet přes gviz JSON (bez publikování na web)

const SHEET_ID = "1zmdO8LU1G8tAgHNtRDRIr5wynfSS_e_MJlT9MRdGNYk";
const SHEET_NAME = "MČR U15 - Zápasy"; // přesně název listu

async function fetchSheetRows() {
  const url =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
    `?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}` +
    `&v=${Date.now()}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);

  const text = await res.text();

  // gviz vrací: google.visualization.Query.setResponse({...});
  const jsonStr = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const json = JSON.parse(jsonStr);

  const cols = json.table.cols.map(c => (c.label || "").trim());
  const rows = json.table.rows.map(r => r.c.map(cell => (cell ? cell.v : null)));

  // rows -> array objektů podle názvů sloupců
  return rows.map(arr => {
    const obj = {};
    cols.forEach((k, i) => (obj[k] = arr[i]));
    return obj;
  });
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // odstraní diakritiku
    .trim();
}

function toNum(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseGvizDate(v) {
  // v může být string typu "Date(2026,0,31,9,0,0)" nebo null
  const s = String(v || "");
  const m = s.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/);
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]); // 0-11
  const d = Number(m[3]);
  const hh = Number(m[4] ?? 0);
  const mm = Number(m[5] ?? 0);
  const ss = Number(m[6] ?? 0);

  return new Date(y, mo, d, hh, mm, ss);
}

function fmtTime(v) {
  const dt = parseGvizDate(v);
  if (!dt) return v ?? "—";
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function fmtDen(v) {
  // když je den text -> vrať text; když Date -> vrať český název dne
  if (v == null) return "";
  if (!String(v).startsWith("Date(")) return String(v);

  const dt = parseGvizDate(v);
  if (!dt) return String(v);

  const days = ["neděle","pondělí","úterý","středa","čtvrtek","pátek","sobota"];
  return days[dt.getDay()];
}

function pillHtml(hala) {
  const n = Number(hala);
  if (n === 1) return '<span class="pill pill--h1">Hala 1</span>';
  if (n === 2) return '<span class="pill pill--h2">Hala 2</span>';
  return `<span class="pill">Hala ${hala ?? "—"}</span>`;
}

function badgeHtml(stav) {
  const s = String(stav || "").toUpperCase();
  if (s === "FIN") return '<span class="badge badge--fin">FIN</span>';
  if (s === "LIVE") return '<span class="badge badge--live">LIVE</span>';
  return '<span class="badge">SCHEDULED</span>';
}

function teamLink(name, id) {
  const n = name ?? "—";
  const tid = String(id || "").trim();
  if (!tid) return n;
  return `<a href="tymy.html#tym-${tid}" class="teamlink">${n}</a>`;
}

function lastCum(row) {
  // kumulativní stav po čtvrtinách: q1d/q1h, q2d/q2h, ...
  const qs = [
    { d: toNum(row.q1d), h: toNum(row.q1h) },
    { d: toNum(row.q2d), h: toNum(row.q2h) },
    { d: toNum(row.q3d), h: toNum(row.q3h) },
    { d: toNum(row.q4d), h: toNum(row.q4h) }
  ];
  for (let i = qs.length - 1; i >= 0; i--) {
    if (Number.isFinite(qs[i].d) && Number.isFinite(qs[i].h)) return qs[i];
  }
  return null;
}

function cumLine(row) {
  const parts = [];
  const q = [
    [row.q1d, row.q1h],
    [row.q2d, row.q2h],
    [row.q3d, row.q3h],
    [row.q4d, row.q4h]
  ];
  q.forEach((pair, i) => {
    const d = toNum(pair[0]);
    const h = toNum(pair[1]);
    if (Number.isFinite(d) && Number.isFinite(h)) parts.push(`Q${i + 1} ${d}:${h}`);
  });
  return parts.join(" • ");
}
