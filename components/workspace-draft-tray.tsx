"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteWorkspaceDraft,
  listWorkspaceDrafts,
  remainingDraftMs,
  setWorkspaceDraftScope,
  workspaceDraftHref,
  workspaceDraftLabel,
  WORKSPACE_DRAFTS_CHANGED_EVENT,
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
  const [drafts, setDrafts] = useState<WorkspaceDraft[]>([]);
  const [open, setOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  const title = useMemo(() => drafts.length ? `มีร่าง ${drafts.length} งาน · เก็บไว้ 24 ชั่วโมง` : "ยังไม่มีงานร่าง", [drafts.length]);
  if (!authenticated) return null;

  return <div className={styles.root} ref={rootRef} data-sc-help-ignore>
    <button type="button" className={styles.trigger} data-has-drafts={drafts.length > 0} onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label={title} title={title}>
      <span className={styles.dot} aria-hidden="true" />
      <span>งานร่าง</span>
      {drafts.length ? <span className={styles.count}>{drafts.length}</span> : null}
    </button>
    {open ? <div className={styles.panel} role="dialog" aria-label="รายการงานร่าง 24 ชั่วโมง">
      <div className={styles.head}>
        <div><b>งานร่างของคุณ</b><small>บันทึกอัตโนมัติบนอุปกรณ์นี้ · อายุ 24 ชั่วโมงจากการแก้ไขล่าสุด</small></div>
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
      </article>)}</div> : <div className={styles.empty}><b>ยังไม่มีร่างที่บันทึกไว้</b><span>เมื่อเริ่มแก้ข้อมูลใน AI Studio, AI Planner หรือ Series Studio ระบบจะสร้างร่างให้อัตโนมัติ</span></div>}
      <div className={styles.foot}>ร่างที่เกิน 24 ชั่วโมงจะถูกลบอัตโนมัติ และไม่ถือเป็นงานที่ Generate หรือใช้เครดิต</div>
    </div> : null}
  </div>;
}
