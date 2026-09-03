"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { VIDEO_MODELS } from "@/lib/catalogs";
import { getVideoModelVersions } from "@/lib/video-model-versions";
import { MODEL_PRICE_EXAMPLE_USD_THB, VIDEO_PRICING, type VideoPricingRow } from "@/lib/video-model-pricing";
import styles from "./models.module.css";

type ApiConnection = {
  id: string;
  provider: string;
  kind: "ANALYZER" | "VIDEO" | "IMAGE" | "VOICE";
  modelId: string | null;
  enabledModelIds: string[];
  status: "CONNECTED" | "INVALID" | "RATE_LIMITED" | "ERROR";
  enabled: boolean;
  virtual?: boolean;
  sharedFromProvider?: string;
};

type Readiness = {
  ready: boolean;
  route: string;
  provider: string | null;
};

const MODEL_ORDER = ["seedance-2-5", "runway", "veo", "kling", "wan"] as const;

const PROVIDER_LABELS: Record<string, string> = {
  seedance: "BytePlus Direct",
  runway: "Runway Developer API",
  veo: "Google Gemini API",
  kling: "Kling API",
  wan: "Alibaba Model Studio",
};

function idsFor(connection: ApiConnection) {
  return connection.enabledModelIds?.length
    ? connection.enabledModelIds
    : connection.modelId
      ? [connection.modelId]
      : [];
}

function connectionMatchesModel(modelId: string, connection: ApiConnection) {
  if (!connection.enabled || connection.status !== "CONNECTED" || connection.kind !== "VIDEO") return false;
  const ids = idsFor(connection);
  if (modelId === "seedance-2-5") {
    return connection.provider === "seedance"
      || (connection.provider === "runway" && ids.some((id) => id === "seedance2_5" || id.startsWith("seedance2")));
  }
  if (modelId === "runway") {
    return connection.provider === "runway" && ids.some((id) => id === "gen4.5" || id === "gen4_turbo" || id.startsWith("gen4"));
  }
  if (modelId === "veo") {
    return connection.provider === "veo"
      || (connection.provider === "runway" && ids.some((id) => id.startsWith("veo3")));
  }
  if (modelId === "kling") return connection.provider === "kling";
  if (modelId === "wan") {
    return connection.provider === "wan"
      || (connection.provider === "runway" && ids.some((id) => id.startsWith("wan3")));
  }
  return false;
}

function readinessFor(modelId: string, connections: ApiConnection[]): Readiness {
  const connection = connections.find((item) => connectionMatchesModel(modelId, item));
  if (!connection) return { ready: false, route: "ยังไม่ได้เชื่อม Video API ที่ใช้รุ่นนี้", provider: null };
  const provider = connection.sharedFromProvider || connection.provider;
  return {
    ready: true,
    route: connection.virtual
      ? `พร้อมผ่านคีย์ร่วมจาก ${PROVIDER_LABELS[provider] || provider}`
      : `พร้อมผ่าน ${PROVIDER_LABELS[connection.provider] || connection.provider}`,
    provider: connection.provider,
  };
}

function money(value: number) {
  return `$${value.toFixed(value < 1 ? 3 : 2).replace(/0+$/, "").replace(/\.$/, "")}`;
}

function exampleFor(row: VideoPricingRow, seconds: number) {
  const usd = row.usdPerSecond * seconds;
  return {
    usd,
    thb: usd * MODEL_PRICE_EXAMPLE_USD_THB,
  };
}

export default function ModelsPage() {
  const [connections, setConnections] = useState<ApiConnection[]>([]);
  const [sharedConnections, setSharedConnections] = useState<ApiConnection[]>([]);
  const [connectionLoaded, setConnectionLoaded] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/api-connections", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!active) return;
        setConnections(payload?.connections || []);
        setSharedConnections(payload?.sharedConnections || []);
        setConnectionLoaded(true);
      })
      .catch(() => { if (active) setConnectionLoaded(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!detailId) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setDetailId(null); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [detailId]);

  const displayConnections = useMemo(() => [...connections, ...sharedConnections], [connections, sharedConnections]);
  const models = useMemo(() => MODEL_ORDER.map((id) => VIDEO_MODELS.find((model) => model.id === id)).filter((model): model is (typeof VIDEO_MODELS)[number] => Boolean(model)), []);
  const readiness = useMemo(() => new Map(models.map((model) => [model.id, readinessFor(model.id, displayConnections)])), [displayConnections, models]);
  const readyCount = useMemo(() => models.filter((model) => readiness.get(model.id)?.ready).length, [models, readiness]);
  const detailModel = detailId ? models.find((model) => model.id === detailId) || null : null;
  const detailPricing = detailModel ? VIDEO_PRICING[detailModel.id] : null;
  const detailReadiness = detailModel ? readiness.get(detailModel.id) : null;

  return (
    <main className={styles.page} data-sc-help-ignore>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>MODEL CENTER · VERIFIED API PRICING</span>
          <h1>โมเดล &amp; เรทราคา</h1>
          <p>ดูสถานะ API ที่บัญชีนี้เชื่อมไว้ เปรียบเทียบราคาผู้ให้บริการจริงต่อวินาทีตามรุ่นและความละเอียด แล้วค่อยตัดสินใจก่อนสร้างงาน</p>
          <div className={styles.heroMeta}>
            <span><i className={styles.readyDot}/><b>{connectionLoaded ? readyCount : "…"}/{models.length}</b> กลุ่มโมเดลพร้อมใช้งาน</span>
            <span>ราคาอ้างอิง Provider · ตรวจล่าสุด 3 ก.ย. 2026</span>
            <span>ตัวอย่างเงินบาทใช้ ≈ ฿{MODEL_PRICE_EXAMPLE_USD_THB}/USD เพื่อช่วยกะงบเท่านั้น</span>
          </div>
        </div>
        <div className={styles.heroActions}>
          <Link href="/profile/api" className={styles.secondaryLink}>API &amp; Models</Link>
          <Link href="/studio#setup" className={styles.primaryLink}>กลับ AI Studio</Link>
        </div>
      </header>

      <section className={styles.legend} aria-label="คำอธิบายสถานะ">
        <div><span className={`${styles.legendMark} ${styles.legendReady}`}/><b>พร้อมใช้งาน</b><small>มี Connection ที่เปิดและทดสอบผ่านสำหรับโมเดลกลุ่มนี้</small></div>
        <div><span className={`${styles.legendMark} ${styles.legendWaiting}`}/><b>ยังไม่พร้อม</b><small>ดูราคาได้ แต่ต้องเชื่อม API ก่อนนำไปสร้างจริง</small></div>
        <div><span className={styles.priceGlyph}>$</span><b>ราคา API จริง</b><small>แสดง USD ตาม Provider; ค่า SCENOVA/ภาษี/FX ไม่รวมในตัวเลขนี้</small></div>
      </section>

      <div className={styles.grid}>
        {models.map((model) => {
          const state = readiness.get(model.id) || { ready: false, route: "กำลังตรวจสถานะ", provider: null };
          const pricing = VIDEO_PRICING[model.id];
          const versions = getVideoModelVersions(model.name);
          const cheapest = pricing?.rows.length ? pricing.rows.reduce((min, row) => row.usdPerSecond < min.usdPerSecond ? row : min, pricing.rows[0]) : null;
          const sample = cheapest && pricing ? exampleFor(cheapest, pricing.exampleSeconds) : null;
          return <article key={model.id} className={`${styles.card} ${state.ready ? styles.cardReady : styles.cardWaiting}`} data-sc-help-ignore>
            <div className={styles.cardTop}>
              <div><b>{model.name}</b><span className={styles.provider}>{model.provider}</span></div>
              <span className={`${styles.statusBadge} ${state.ready ? styles.statusReady : styles.statusWaiting}`}><i/>{connectionLoaded ? (state.ready ? "พร้อมใช้งาน" : "ยังไม่พร้อม") : "กำลังตรวจ"}</span>
            </div>

            <div className={styles.routeLine}>{state.route}</div>
            <p className={styles.description}>{model.descriptionTh}</p>

            <div className={styles.pricePanel}>
              <div><span>ราคา Provider</span><b>{pricing?.headline || "ตรวจจาก Provider"}</b></div>
              <div><span>ตัวอย่างงบ</span><b>{sample && pricing ? `${pricing.exampleSeconds} วิ ≈ ${money(sample.usd)} · ฿${sample.thb.toFixed(0)}` : "ขึ้นกับ Plan"}</b></div>
            </div>

            <div className={styles.versionTags}>{versions.map((version) => <span key={version.apiModelId} data-recommended={version.recommended || undefined}>{version.label}{version.recommended ? " · แนะนำ" : ""}</span>)}</div>

            <div className={styles.specs}>
              {[[`${model.maxSecondsPerGeneration} วิ`, "สูงสุด / generation"], [model.resolutions.join(" / "), "Resolution"], [model.supportsAudio ? "รองรับ" : "ไม่รองรับ", "Audio"], [model.supportsVideoReference ? "รองรับ" : "ไม่รองรับ", "Video Reference"]].map(([value, label]) => <div key={label} className={styles.spec}><b>{value}</b><span>{label}</span></div>)}
            </div>

            <div className={styles.tags}>{model.bestFor.map((tag) => <span key={tag}>{tag}</span>)}</div>
            <button type="button" className={styles.detailsButton} onClick={() => setDetailId(model.id)}>ดูรายละเอียดราคาและรุ่น →</button>
          </article>;
        })}
      </div>

      {detailModel && detailPricing ? <div className={styles.detailBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setDetailId(null); }}>
        <section className={styles.detailDialog} role="dialog" aria-modal="true" aria-labelledby="model-detail-title">
          <button type="button" className={styles.closeButton} aria-label="ปิดรายละเอียด" onClick={() => setDetailId(null)}>×</button>
          <div className={styles.detailHead}>
            <div>
              <span className={styles.eyebrow}>MODEL PRICE DETAIL</span>
              <h2 id="model-detail-title">{detailModel.name}</h2>
              <p>{detailModel.descriptionTh}</p>
            </div>
            <span className={`${styles.statusBadge} ${detailReadiness?.ready ? styles.statusReady : styles.statusWaiting}`}><i/>{detailReadiness?.ready ? "พร้อมใช้งาน" : "ยังไม่เชื่อม API"}</span>
          </div>

          <div className={styles.detailRoute}><b>เส้นทางบัญชีนี้</b><span>{detailReadiness?.route}</span></div>

          {detailPricing.rows.length ? <div className={styles.priceTableWrap}>
            <table className={styles.priceTable}>
              <thead><tr><th>เส้นทาง API / รุ่น</th><th>ความละเอียด</th><th>ราคาต่อวินาที</th><th>ตัวอย่าง {detailPricing.exampleSeconds} วินาที</th></tr></thead>
              <tbody>{detailPricing.rows.map((row, index) => {
                const example = exampleFor(row, detailPricing.exampleSeconds);
                return <tr key={`${row.route}-${row.model}-${row.resolution}-${index}`}>
                  <td><b>{row.model}</b><small>{row.route}</small>{row.note ? <em>{row.note}</em> : null}</td>
                  <td>{row.resolution}</td>
                  <td><strong>{row.approximate ? "≈ " : ""}{money(row.usdPerSecond)}/วิ</strong>{row.listUsdPerSecond ? <small className={styles.oldPrice}>List {money(row.listUsdPerSecond)}/วิ</small> : null}</td>
                  <td><strong>{row.approximate ? "≈ " : ""}{money(example.usd)}</strong><small>≈ ฿{example.thb.toFixed(0)}</small></td>
                </tr>;
              })}</tbody>
            </table>
          </div> : <div className={styles.noPublicPrice}><b>ยังไม่มีราคาต่อวินาทีจาก official public table ที่ SCENOVA ยืนยันได้</b><p>จึงไม่ดึงราคาจากเว็บตัวกลางมาใส่แทน กรุณาตรวจ plan/billing ของ {detailModel.name} ที่บัญชี Provider โดยตรงก่อนสร้างงาน</p></div>}

          <div className={styles.detailNotes}>
            {detailPricing.notes.map((note) => <p key={note}>• {note}</p>)}
            <p>• ตัวอย่าง THB ใช้อัตราสมมติ {MODEL_PRICE_EXAMPLE_USD_THB} บาท/USD เพื่อกะงบเท่านั้น ยอดเรียกเก็บจริงขึ้นกับ Provider, FX, ภาษี, input/reference และตัวเลือก generation</p>
          </div>

          <div className={styles.detailFooter}>
            <div className={styles.sources}><span>แหล่งราคา:</span>{detailPricing.sources.length ? detailPricing.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>) : <small>ตรวจจาก Provider account</small>}<small>ตรวจล่าสุด {detailPricing.verifiedAt}</small></div>
            <div className={styles.detailActions}>
              <Link href="/profile/api" className={styles.secondaryLink}>{detailReadiness?.ready ? "ตรวจ API" : "เชื่อม API"}</Link>
              {detailReadiness?.ready ? <Link href="/studio#setup" className={styles.primaryLink}>ใช้ใน AI Studio →</Link> : null}
            </div>
          </div>
        </section>
      </div> : null}
    </main>
  );
}
