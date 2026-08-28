import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth-core";
import { getSystemProviderCredential } from "@/lib/api-connections/providers";
import { getUserApiConnectionSecret } from "@/lib/api-connections/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function currentUser() {
  const store = await cookies();
  return resolveSession(store.get("scenova_session")?.value);
}

function safeGoogleMediaUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    if (url.hostname !== "googleapis.com" && !url.hostname.endsWith(".googleapis.com")) return null;
    return url;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const query = new URL(request.url).searchParams;
  const provider = query.get("provider") || "";
  const connectionId = query.get("connectionId") || "";
  const target = safeGoogleMediaUrl(query.get("url") || "");
  if (provider !== "veo" || !target) return NextResponse.json({ error: "INVALID_PROVIDER_MEDIA_URL" }, { status: 400 });

  let apiKey = "";
  if (connectionId) {
    const credential = await getUserApiConnectionSecret({ userId: user.id, provider: "veo", kind: "VIDEO" });
    if (!credential || credential.connection.id !== connectionId) return NextResponse.json({ error: "PROVIDER_CONNECTION_NOT_FOUND" }, { status: 404 });
    apiKey = credential.apiKey;
  } else {
    apiKey = getSystemProviderCredential("veo", "VIDEO")?.apiKey || "";
  }
  if (!apiKey) return NextResponse.json({ error: "PROVIDER_CREDENTIAL_REQUIRED" }, { status: 503 });

  const range = request.headers.get("range");
  const upstream = await fetch(target, {
    headers: {
      "x-goog-api-key": apiKey,
      ...(range ? { Range: range } : {}),
    },
    cache: "no-store",
  });
  if (!upstream.ok && upstream.status !== 206) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json({ error: `VEO_MEDIA_HTTP_${upstream.status}`, detail: detail.slice(0, 300) }, { status: upstream.status });
  }

  const headers = new Headers();
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Disposition", "inline");
  return new Response(upstream.body, { status: upstream.status, headers });
}
