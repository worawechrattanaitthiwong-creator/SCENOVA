import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PALETTES = [
  ["#d9b84a", "#493b17", "#15130c"],
  ["#c9a742", "#2e353d", "#111316"],
  ["#e0c367", "#413044", "#171116"],
  ["#d2b04a", "#25392f", "#101612"],
  ["#e2c76d", "#41352f", "#17130f"],
  ["#cbb45d", "#2d3042", "#11121a"],
];

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return Math.abs(result >>> 0);
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char] || char));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawName = (url.searchParams.get("name") || "SCENOVA Character").slice(0, 48);
  const seed = `${url.searchParams.get("seed") || "character"}:${rawName}`;
  const value = hash(seed);
  const palette = PALETTES[value % PALETTES.length];
  const name = escapeXml(rawName);
  const initials = escapeXml(rawName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "SC");
  const faceShift = (value % 9) - 4;
  const hairVariant = value % 3;
  const hairPath = hairVariant === 0
    ? `M73 101c3-34 21-54 47-54 31 0 50 24 49 58-14-14-31-20-49-20-18 0-34 5-47 16Z`
    : hairVariant === 1
      ? `M71 104c1-39 21-60 50-60 34 0 52 27 49 66-14-10-31-15-49-15-20 0-36 4-50 9Z`
      : `M75 99c6-31 23-49 47-49 28 0 46 20 47 52-12-8-28-13-47-13-18 0-34 3-47 10Z`;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 150" role="img" aria-label="${name}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#080808"/><stop offset=".55" stop-color="${palette[2]}"/><stop offset="1" stop-color="${palette[1]}"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="60%"><stop stop-color="${palette[0]}" stop-opacity=".22"/><stop offset="1" stop-color="${palette[0]}" stop-opacity="0"/></radialGradient>
    <linearGradient id="skin" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d9b89a"/><stop offset="1" stop-color="#8c6a55"/></linearGradient>
  </defs>
  <rect width="240" height="150" rx="18" fill="url(#bg)"/>
  <rect x="1" y="1" width="238" height="148" rx="17" fill="none" stroke="#5d4d22" stroke-opacity=".65"/>
  <circle cx="124" cy="68" r="68" fill="url(#glow)"/>
  <path d="M66 151c7-31 29-48 56-48 30 0 51 17 59 48" fill="#111" stroke="#6b5924" stroke-width="1.2"/>
  <path d="${hairPath}" fill="#171512" stroke="#6a5721" stroke-width="1.2"/>
  <ellipse cx="121" cy="84" rx="31" ry="37" fill="url(#skin)"/>
  <path d="M98 81c6-3 12-4 18-1M128 80c6-2 12-1 17 2" fill="none" stroke="#2b211c" stroke-width="2" stroke-linecap="round"/>
  <circle cx="108" cy="84" r="2.2" fill="#1a1614"/><circle cx="136" cy="85" r="2.2" fill="#1a1614"/>
  <path d="M121 ${94 + faceShift * .15}c-2 4-2 8 0 11" fill="none" stroke="#765444" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M111 111c7 5 15 5 22 0" fill="none" stroke="#5d3c35" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M87 68c5-20 18-33 35-33 20 0 34 13 39 34" fill="none" stroke="${palette[0]}" stroke-opacity=".2" stroke-width="1"/>
  <g opacity=".95"><circle cx="28" cy="26" r="14" fill="#090909" stroke="#5e4f24"/><text x="28" y="30" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" font-weight="800" fill="${palette[0]}">${initials}</text></g>
  <text x="16" y="134" font-family="system-ui,sans-serif" font-size="9" font-weight="800" fill="#f0e6bd">${name}</text>
  <text x="16" y="145" font-family="system-ui,sans-serif" font-size="6.5" fill="#a79c78">SCENOVA CHARACTER REFERENCE</text>
  <path d="M214 18l2.7 6.3L223 27l-6.3 2.7L214 36l-2.7-6.3L205 27l6.3-2.7L214 18Z" fill="${palette[0]}"/>
</svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
