"use client";

export function modelBrandKey(label: string) {
  const value = label.toLocaleLowerCase();
  if (value.includes("seedance")) return "seedance";
  if (value.includes("gemini")) return "gemini";
  if (value.includes("aleph")) return "aleph";
  if (value.includes("ruby")) return "ruby";
  if (value.includes("kling")) return "kling";
  if (value.includes("veo")) return "veo";
  if (value.includes("wan")) return "wan";
  if (value.includes("runway")) return "runway";
  return "ai";
}

export default function ModelBrandIcon({ label, size = 30 }: { label: string; size?: number }) {
  const brand = modelBrandKey(label);
  const common = {
    width: size,
    height: size,
    minWidth: size,
  } as const;

  if (brand === "runway") {
    return <span className="sc-model-brand sc-model-brand-runway" style={common} aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M7 6h8.2c5 0 8.2 2.5 8.2 6.8 0 3.1-1.7 5.2-4.4 6.2L25 26h-6l-5.1-6.2H12V26H7V6Zm5 4.2v5.5h3.1c2.1 0 3.3-.9 3.3-2.8 0-1.8-1.2-2.7-3.3-2.7H12Z" fill="currentColor"/><path d="M3.5 7.5 8 3l2.4 2.4L5.9 9.9 3.5 7.5Z" fill="currentColor" opacity=".72"/></svg></span>;
  }
  if (brand === "seedance") {
    return <span className="sc-model-brand sc-model-brand-seedance" style={common} aria-hidden="true"><svg viewBox="0 0 32 32"><defs><linearGradient id="scSeedance" x1="5" y1="4" x2="28" y2="28"><stop stopColor="#70f0ff"/><stop offset="1" stopColor="#4875ff"/></linearGradient></defs><circle cx="16" cy="16" r="14" fill="url(#scSeedance)"/><path d="M8.2 12.1 22.6 7l-5.1 6.1h6.3L9.1 25l5-7H8.2l5-5.9h-5Z" fill="white"/></svg></span>;
  }
  if (brand === "gemini") {
    return <span className="sc-model-brand sc-model-brand-gemini" style={common} aria-hidden="true"><svg viewBox="0 0 32 32"><defs><linearGradient id="scGemini" x1="5" y1="27" x2="27" y2="5"><stop stopColor="#4c6fff"/><stop offset=".48" stopColor="#a56cff"/><stop offset="1" stopColor="#55d8ff"/></linearGradient></defs><path d="M16 3c1.7 7.2 5.8 11.3 13 13-7.2 1.7-11.3 5.8-13 13-1.7-7.2-5.8-11.3-13-13C10.2 14.3 14.3 10.2 16 3Z" fill="url(#scGemini)"/></svg></span>;
  }
  if (brand === "aleph") {
    return <span className="sc-model-brand sc-model-brand-aleph" style={common} aria-hidden="true"><svg viewBox="0 0 32 32"><path d="m8 25 7.2-18h4.6L27 25h-5.2l-1.4-4H13l-1.5 4H8Zm6.5-8h4.4l-2.2-6.1L14.5 17Z" fill="currentColor"/><path d="M5 8h6v4H5z" fill="currentColor" opacity=".65"/></svg></span>;
  }
  if (brand === "ruby") {
    return <span className="sc-model-brand sc-model-brand-ruby" style={common} aria-hidden="true"><svg viewBox="0 0 32 32"><path d="m16 29-12-14L9 6h14l5 9-12 14Z" fill="#ef476f"/><path d="M4 15h24M9 6l7 23M23 6l-7 23M9 6l7 9 7-9" stroke="#ff9bb1" strokeWidth="1.2" fill="none"/></svg></span>;
  }
  if (brand === "kling") {
    return <span className="sc-model-brand sc-model-brand-kling" style={common} aria-hidden="true"><svg viewBox="0 0 32 32"><defs><linearGradient id="scKling" x1="4" y1="5" x2="29" y2="27"><stop stopColor="#59f3c4"/><stop offset=".5" stopColor="#2d9cff"/><stop offset="1" stopColor="#845bff"/></linearGradient></defs><path d="M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm0 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z" fill="url(#scKling)"/><path d="M9 8.5 23.5 23" stroke="#071018" strokeWidth="4.2" strokeLinecap="round"/></svg></span>;
  }
  if (brand === "veo") {
    return <span className="sc-model-brand sc-model-brand-veo" style={common} aria-hidden="true"><svg viewBox="0 0 32 32"><rect x="5" y="7" width="22" height="18" rx="5" fill="#fff"/><path d="M5 12a5 5 0 0 1 5-5h6v9H5v-4Z" fill="#4285f4"/><path d="M16 7h6a5 5 0 0 1 5 5v4H16V7Z" fill="#34a853"/><path d="M5 16h11v9h-6a5 5 0 0 1-5-5v-4Z" fill="#fbbc05"/><path d="M16 16h11v4a5 5 0 0 1-5 5h-6v-9Z" fill="#ea4335"/><path d="m13.5 12 7 4-7 4v-8Z" fill="white"/></svg></span>;
  }
  if (brand === "wan") {
    return <span className="sc-model-brand sc-model-brand-wan" style={common} aria-hidden="true"><svg viewBox="0 0 32 32"><defs><linearGradient id="scWan" x1="4" y1="4" x2="28" y2="28"><stop stopColor="#c79bff"/><stop offset="1" stopColor="#6e4dff"/></linearGradient></defs><path d="M16 3 22 6l5 5v10l-5 5-6 3-6-3-5-5V11l5-5 6-3Z" fill="url(#scWan)"/><path d="m9 11 3.5 11L16 14l3.5 8L23 11" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg></span>;
  }
  return <span className="sc-model-brand sc-model-brand-ai" style={common} aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 4 27 10v12l-11 6L5 22V10l11-6Z" fill="currentColor" opacity=".22"/><path d="M16 8 23 12v8l-7 4-7-4v-8l7-4Z" stroke="currentColor" strokeWidth="2" fill="none"/></svg></span>;
}
