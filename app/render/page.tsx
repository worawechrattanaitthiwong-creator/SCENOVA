"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./render.module.css";

type RenderJob = {
  id: string;
  project: string;
  ep: string;
  model: string;
  provider: string;
  duration: string;
  status: string;
  progress: number;
};

type ApiConnection = {
  provider: string;
  kind: string;
  status: string;
  enabled: boolean;
};

type ProviderDefinition = {
  id: string;
  kind: string;
  ready: boolean;
  systemConfigured: boolean;
};

type ConnectionsPayload = {
  connections?: ApiConnection[];
  providers?: ProviderDefinition[];
};

const INITIAL_JOBS: RenderJob[] = [
  { id: "R-001", project: "เด็กหญิงกับสิ่งมีชีวิตลึกลับ", ep: "EP01", model: "Seedance 2.5", provider: "seedance", duration: "30s", status: "พร้อมสร้าง", progress: 0 },
  { id: "R-002", project: "เมืองอนาคต", ep: "EP02", model: "Veo", provider: "veo", duration: "8s", status: "รอคิว", progress: 35 },
];

const DELETED_DEMO_JOBS_KEY = "scenova-render-demo-deleted-jobs";

export default function RenderQueuePage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<RenderJob[]>(INITIAL_JOBS);
  const [connections, setConnections] = useState<ApiConnection[]>([]);
  const [providers, setProviders] = useState<ProviderDefinition[]>([]);
  const [readinessLoaded, setReadinessLoaded] = useState(false);

  useEffect(() => {
    const topbar = document.querySelector<HTMLElement>("[data-sc-topbar]");
    const workspace = document.querySelector<HTMLElement>("[data-sc-workspace]");
    const previousDisplay = topbar?.style.display || "";
    const previousGridTemplateRows = workspace?.style.gridTemplateRows || "";

    if (topbar) topbar.style.display = "none";
    if (workspace) workspace.style.gridTemplateRows = "minmax(0, 1fr)";

    return () => {
      if (topbar) topbar.style.display = previousDisplay;
      if (workspace) workspace.style.gridTemplateRows = previousGridTemplateRows;
    };
  }, []);

  useEffect(() => {
    try {
      const deleted = JSON.parse(localStorage.getItem(DELETED_DEMO_JOBS_KEY) || "[]") as unknown;
      if (Array.isArray(deleted)) {
        const deletedIds = new Set(deleted.filter((value): value is string => typeof value === "string"));
        setJobs(INITIAL_JOBS.filter((job) => !deletedIds.has(job.id)));
      }
    } catch {
      localStorage.removeItem(DELETED_DEMO_JOBS_KEY);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/api-connections", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() as Promise<ConnectionsPayload> : null)
      .then((data) => {
        if (!active) return;
        setConnections(Array.isArray(data?.connections) ? data.connections : []);
        setProviders(Array.isArray(data?.providers) ? data.providers : []);
        setReadinessLoaded(true);
      })
      .catch(() => {
        if (active) setReadinessLoaded(true);
      });
    return () => { active = false; };
  }, []);

  const readinessByProvider = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const provider of providers) {
      if (provider.kind !== "VIDEO") continue;
      const connection = connections.find((item) => item.kind === "VIDEO" && item.provider === provider.id);
      const connected = Boolean(connection?.enabled && connection.status === "CONNECTED");
      map.set(provider.id, Boolean(provider.ready && (connected || provider.systemConfigured)));
    }
    return map;
  }, [connections, providers]);

  function deleteJob(job: RenderJob) {
    if (!window.confirm(`ลบ ${job.id} · ${job.project} ออกจากคิวตัวอย่างนี้หรือไม่?`)) return;
    const next = jobs.filter((item) => item.id !== job.id);
    setJobs(next);
    const deletedIds = INITIAL_JOBS.filter((item) => !next.some((current) => current.id === item.id)).map((item) => item.id);
    localStorage.setItem(DELETED_DEMO_JOBS_KEY, JSON.stringify(deletedIds));
  }

  return (
    <main className={styles.page}>
      <div className={styles.pageActions}>
        <button type="button" className={styles.backButton} onClick={() => router.back()}>← ย้อนกลับ</button>
        <Link href="/libraries?tab=videos" className={styles.primaryLink}>เปิดคลังวิดีโอ</Link>
      </div>

      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>RENDER QUEUE</span>
          <h1>งานสร้างคลิป</h1>
          <p>ศูนย์รวมงานที่รอ กำลังสร้าง สำเร็จ หรือล้มเหลว พร้อมตรวจสถานะ Video Provider ก่อนเปิดให้แก้ไขโมเดล</p>
        </div>
      </header>

      <div className={styles.demoNotice}>
        <b>สถานะ: UX DEMO</b> — รายการด้านล่างยังเป็นข้อมูลตัวอย่าง การแก้ไขโมเดลจะพาไปหน้าตั้งค่า API & Models ของ Provider ที่พร้อมใช้งาน และการลบคิวจะซ่อนเฉพาะรายการตัวอย่างบนเบราว์เซอร์นี้
      </div>

      <section className={styles.list} aria-label="ตัวอย่าง Render Queue">
        {jobs.map((job) => {
          const modelReady = readinessLoaded && readinessByProvider.get(job.provider) === true;
          const readinessText = !readinessLoaded ? "กำลังตรวจสอบ..." : modelReady ? "พร้อมใช้งาน" : "ยังไม่พร้อมใช้งาน";
          return <article key={job.id} className={styles.job}>
            <div className={styles.row}>
              <span className={styles.id}>{job.id}</span>
              <div className={styles.project}><b>{job.project}</b><small>{job.ep}</small></div>
              <span className={styles.value}>{job.duration}</span>

              <div className={styles.modelCell}>
                {modelReady ? (
                  <Link
                    href={`/profile/api?kind=VIDEO&provider=${encodeURIComponent(job.provider)}`}
                    className={styles.modelButton}
                    title={`แก้ไขการตั้งค่า ${job.model}`}
                  >
                    <b>{job.model}</b>
                    <small>แก้ไขโมเดล</small>
                  </Link>
                ) : (
                  <button type="button" className={`${styles.modelButton} ${styles.modelDisabled}`} disabled>
                    <b>{job.model}</b>
                    <small>{readinessText}</small>
                  </button>
                )}
              </div>

              <span className={modelReady ? styles.status : styles.statusUnavailable}>
                {modelReady ? job.status : readinessText}
              </span>

              <div className={styles.jobActions}>
                <span className={styles.sample}>ตัวอย่าง</span>
                <button type="button" className={styles.deleteButton} onClick={() => deleteJob(job)}>ลบคิว</button>
              </div>
            </div>
            <div className={styles.track} aria-label={`ความคืบหน้าตัวอย่าง ${job.progress}%`}><div className={styles.bar} style={{ width: `${job.progress}%` }} /></div>
          </article>;
        })}

        {jobs.length === 0 ? (
          <div className={styles.emptyState}>
            <b>ไม่มีงานในคิวตัวอย่าง</b>
            <p>รายการตัวอย่างถูกลบออกจากเบราว์เซอร์นี้แล้ว</p>
          </div>
        ) : null}
      </section>

      <p className={styles.emptyHint}>สถานะความพร้อมของโมเดลอ่านจาก API & Models ที่บัญชีนี้เชื่อมต่ออยู่ หาก Provider ยังไม่พร้อม ปุ่มแก้ไขโมเดลจะถูกปิดและจะแสดงว่า “ยังไม่พร้อมใช้งาน”</p>
    </main>
  );
}
