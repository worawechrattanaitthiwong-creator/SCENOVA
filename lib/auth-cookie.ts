import type { NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "scenova_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function isSecureRequest(request: Request) {
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

function serializeCookie(input: {
  name: string;
  value: string;
  maxAge: number;
  sameSite: "Lax" | "Strict";
  secure: boolean;
}) {
  const parts = [
    `${input.name}=${encodeURIComponent(input.value)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${input.sameSite}`,
    `Max-Age=${input.maxAge}`,
  ];
  if (input.secure) parts.push("Secure");
  return parts.join("; ");
}

export function setPrivateNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export function attachSessionCookie(response: NextResponse, token: string, request: Request) {
  setPrivateNoStore(response);
  response.headers.append(
    "Set-Cookie",
    serializeCookie({
      name: SESSION_COOKIE_NAME,
      value: token,
      maxAge: SESSION_MAX_AGE_SECONDS,
      sameSite: "Lax",
      secure: isSecureRequest(request),
    }),
  );
  return response;
}

export function clearSessionCookie(response: NextResponse, request: Request) {
  setPrivateNoStore(response);
  response.headers.append(
    "Set-Cookie",
    serializeCookie({
      name: SESSION_COOKIE_NAME,
      value: "",
      maxAge: 0,
      sameSite: "Lax",
      secure: isSecureRequest(request),
    }),
  );
  return response;
}
