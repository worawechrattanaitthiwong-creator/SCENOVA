import { PORTAL_HERO_BASE64 } from "../../../lib/portal-hero-inline";

const HERO_BYTES = Buffer.from(PORTAL_HERO_BASE64, "base64");

export async function GET() {
  return new Response(HERO_BYTES, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(HERO_BYTES.byteLength),
    },
  });
}
