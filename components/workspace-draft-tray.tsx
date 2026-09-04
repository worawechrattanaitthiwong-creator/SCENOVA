"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteWorkspaceDraft,
  listWorkspaceDrafts,
  remainingDraftMs,
  setWorkspaceDraftScope,
  workspaceDraftHref,
  workspaceDraftLabel,
  WORKSPACE_DRAFTS_CHANGED_EVENT,
  WORKSPACE_DRAFT_SAVE_REQUEST_EVENT,
  WORKSPACE_DRAFT_SAVED_EVENT,
  WORKSPACE_DRAFT_SCOPE_READY_EVENT,
  type WorkspaceDraft,
} from "@/lib/workspace-drafts-client";
import styles from "./workspace-draft-tray.module.css";

function relativeUpdated(value: string) {
  const delta = Math.max(0, Date.now() - Date.parse(value));
  if (delta < 60_000) return "แก้ไขเมื่อสักครู่";
  if (delta < 3_600_000) return `แก้ไข ${Math.max(1, Math.floor(delta / 60_000))} นาทีที่แล้ว`;
  return `แก้ไข ${Math.max(1, Math.floor(delta / 3_600_000))} ชม.ที่แล้ว`;
}

function expiresText(draft: WorkspaceDraft) {
  const remaining = remainingDraftMs(draft);
  if (remaining <= 0) return "หมดอายุ";
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.ceil((remaining % 3_600_000) / 60_000);
  return hours > 0 ? `เหลือ ${hours} ชม. ${minutes} นาที` : `เหลือ ${minutes} นาที`;
}

export default function WorkspaceDraftTray() {
  const pathname = usePathname();
  const [drafts, setDrafts] = useState<WorkspaceDraft[]>([]);
  const [open, setOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [floatingTop, setFloatingTop] = useState(14);
  const rootRef = useRef<HTMLDivElement>(null);
  const saveResetTimer = useRef<number | null>(null);
  const canSaveHere = pathname === "/studio" || pathname === "/agent" || pathname === "/series";

  const refresh = () => setDrafts(listWorkspaceDrafts());

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json())
      .then((data: { authenticated?: boolean; email?: string; name?: string }) => {
        if (!active || !data.authenticated) return;
        const identity = data.email || data.name || "scenova-member";
        setWorkspaceDraftScope(identity);
        setAuthenticated(true);
        refresh();
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    refresh();
    const changed = () => refresh();
    window.addEventListener(WORKSPACE_DRAFTS_CHANGED_EVENT, changed);
    window.addEventListener(WORKSPACE_DRAFT_SCOPE_READY_EVENT, changed);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener(WORKSPACE_DRAFTS_CHANGED_EVENT, changed);
      window.removeEventListener(WORKSPACE_DRAFT_SCOPE_READY_EVENT, changed);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const saved = (event: Event) => {
      const detail = (event as CustomEvent<{ ok?: boolean; message?: string }>).detail || {};
      setSaveStatus(detail.ok ? "saved" : "error");
      setSaveMessage(detail.message || (detail.ok ? "บันทึกร่างแล้ว" : "บันทึกร่างไม่สำเร็จ"));
      if (saveResetTimer.current) window.clearTimeout(saveResetTimer.current);
      saveResetTimer.current = window.setTimeout(() => {
        setSaveStatus("idle");
        setSaveMessage("");
      }, 2200);
    };
    window.addEventListener(WORKSPACE_DRAFT_SAVED_EVENT, saved);
    return () => {
      window.removeEventListener(WORKSPACE_DRAFT_SAVED_EVENT, saved);
      if (saveResetTimer.current) window.clearTimeout(saveResetTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  useEffect(() => {
    const syncFloatingTop = () => {
      const mobile = window.matchMedia("(max-width:700px)").matches;
      const baseTop = mobile ? 9 : 14;
      const notice = document.querySelector<HTMLElement>(".sc-submit-feedback");
      if (!notice) {
        setFloatingTop(baseTop);
        return;
      }
      const rect = notice.getBoundingClientRect();
      const next = Math.max(baseTop, Math.ceil(rect.bottom + (mobile ? 8 : 10)));
      setFloatingTop(next);
    };

    syncFloatingTop();
    const observer = new MutationObserver(syncFloatingTop);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    window.addEventListener("resize", syncFloatingTop);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncFloatingTop);
    };
  }, []);

  const title = useMemo(() => drafts.length ? `มีร่าง ${drafts.length} งาน · เก็บไว้ 24 ชั่วโมง` : "ยังไม่มีงานร่าง", [drafts.length]);
  if (!authenticated) return null;

  return <div className={styles.root} ref={rootRef} data-sc-help-ignore style={{ top: floatingTop }}>
    {canSaveHere ? <button
      type="button"
      className={styles.save}
      data-state={saveStatus}
      disabled={saveStatus === "saving"}
      title={saveMessage || "บันทึก Workspace ปัจจุบันเป็นงานร่าง"}
      onClick={() => {
        setSaveStatus("saving");
        setSaveMessage("กำลังบันทึกร่าง...");
        window.dispatchEvent(new CustomEvent(WORKSPACE_DRAFT_SAVE_REQUEST_EVENT));
      }}
    >{saveStatus === "saving" ? "กำลังบันทึก…" : saveStatus === "saved" ? "✓ บันทึกแล้ว" : saveStatus === "error" ? "ลองบันทึกอีกครั้ง" : "＋ บันทึกร่าง"}</button> : null}
    <button type="button" className={styles.trigger} data-has-drafts={drafts.length > 0} onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label={title} title={title}>
      <span className={styles.dot} aria-hidden="true" />
      <span>งานร่าง</span>
      {drafts.length ? <span className={styles.count}>{drafts.length}</span> : null}
    </button>
    {open ? <div className={styles.panel} role="dialog" aria-label="รายการงานร่าง 24 ชั่วโมง" style={{ maxHeight: `min(560px, calc(100vh - ${floatingTop + 60}px))` }}>
      <div className={styles.head}>
        <div><b>งานร่างของคุณ</b><small>เก็บเฉพาะเมื่อกด “บันทึกร่าง” · อายุ 24 ชั่วโมงจากการบันทึกล่าสุด</small></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="ปิด">×</button>
      </div>
      {drafts.length ? <div className={styles.list}>{drafts.map((draft) => <article className={styles.item} key={draft.id}>
        <div className={styles.copy}>
          <b>{draft.title}</b>
          <span>{workspaceDraftLabel(draft.workspace)} · {expiresText(draft)}</span>
          <small>{relativeUpdated(draft.updatedAt)}</small>
        </div>
        <div className={styles.actions}>
          <Link className={styles.open} href={workspaceDraftHref(draft)} prefetch={false} onClick={() => setOpen(false)}>ทำต่อ</Link>
          <button type="button" className={styles.delete} onClick={() => { deleteWorkspaceDraft(draft.id); refresh(); }}>ลบ</button>
        </div>
      </article>)}</div> : <div className={styles.empty}><b>ยังไม่มีร่างที่บันทึกไว้</b><span>กรอกข้อมูลใน Workspace แล้วกด “บันทึกร่าง” เมื่อต้องการเก็บงานไว้ทำต่อ</span></div>}
      <div className={styles.foot}>SCENOVA จะไม่สร้างร่างจากการพิมพ์หรือการเปลี่ยนค่าอัตโนมัติ · ร่างที่บันทึกจะหมดอายุใน 24 ชั่วโมงและไม่ใช้เครดิต</div>
    </div> : null}
  </div>;
}
