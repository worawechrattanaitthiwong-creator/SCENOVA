"use client";

import { useEffect, useRef } from "react";

export type WorkspaceDraftKind = "studio" | "agent" | "series";

export type WorkspaceDraft<T = unknown> = {
  id: string;
  workspace: WorkspaceDraftKind;
  title: string;
  data: T;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export const WORKSPACE_DRAFTS_CHANGED_EVENT = "scenova:workspace-drafts-changed";
export const WORKSPACE_DRAFT_SCOPE_READY_EVENT = "scenova:workspace-draft-scope-ready";
export const WORKSPACE_DRAFT_SAVE_REQUEST_EVENT = "scenova:workspace-draft-save-request";
export const WORKSPACE_DRAFT_SAVED_EVENT = "scenova:workspace-draft-saved";
export const WORKSPACE_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

const SCOPE_KEY = "scenova-workspace-draft-scope-v1";
const LEGACY_STORAGE_PREFIX = "scenova-workspace-drafts-v1:";
const STORAGE_PREFIX = "scenova-workspace-drafts-v2:";
const MAX_DRAFTS = 30;

function browserReady() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function identityHash(value: string) {
  const normalized = value.trim().toLocaleLowerCase();
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `u${(hash >>> 0).toString(36)}`;
}

export function setWorkspaceDraftScope(identity: string) {
  if (!browserReady() || !identity.trim()) return "";
  const scope = identityHash(identity);
  const current = localStorage.getItem(SCOPE_KEY) || "";
  localStorage.setItem(SCOPE_KEY, scope);
  // v1 drafts were created implicitly by autosave. Manual-draft mode starts clean
  // so no draft appears unless the user explicitly presses “บันทึกร่าง”.
  localStorage.removeItem(`${LEGACY_STORAGE_PREFIX}${scope}`);
  if (current !== scope) window.dispatchEvent(new CustomEvent(WORKSPACE_DRAFTS_CHANGED_EVENT));
  window.dispatchEvent(new CustomEvent(WORKSPACE_DRAFT_SCOPE_READY_EVENT, { detail: { scope } }));
  return scope;
}

export function getWorkspaceDraftScope() {
  if (!browserReady()) return "";
  return localStorage.getItem(SCOPE_KEY) || "";
}

function storageKey() {
  const scope = getWorkspaceDraftScope();
  return scope ? `${STORAGE_PREFIX}${scope}` : "";
}

function readRaw(): WorkspaceDraft[] {
  if (!browserReady()) return [];
  const key = storageKey();
  if (!key) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]") as WorkspaceDraft[];
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === "string" && typeof item.workspace === "string") : [];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

function writeRaw(items: WorkspaceDraft[]) {
  if (!browserReady()) return;
  const key = storageKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(items.slice(0, MAX_DRAFTS)));
  window.dispatchEvent(new CustomEvent(WORKSPACE_DRAFTS_CHANGED_EVENT));
}

function purge(items: WorkspaceDraft[], now = Date.now()) {
  return items.filter((item) => Number.isFinite(Date.parse(item.expiresAt)) && Date.parse(item.expiresAt) > now);
}

export function purgeExpiredWorkspaceDrafts() {
  const all = readRaw();
  const next = purge(all);
  if (next.length !== all.length) writeRaw(next);
  return next;
}

export function listWorkspaceDrafts() {
  return purgeExpiredWorkspaceDrafts().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function readWorkspaceDraft<T = unknown>(id: string) {
  return listWorkspaceDrafts().find((item) => item.id === id) as WorkspaceDraft<T> | undefined;
}

export function saveWorkspaceDraft<T>(input: {
  id?: string;
  workspace: WorkspaceDraftKind;
  title: string;
  data: T;
}) {
  const key = storageKey();
  if (!key) return null;
  const now = new Date();
  const all = listWorkspaceDrafts();
  const existing = input.id ? all.find((item) => item.id === input.id) : undefined;
  const id = existing?.id || input.id || crypto.randomUUID();
  const draft: WorkspaceDraft<T> = {
    id,
    workspace: input.workspace,
    title: input.title.trim() || (input.workspace === "studio" ? "ร่าง AI Studio" : input.workspace === "series" ? "ร่าง Series Studio" : "ร่าง AI Planner"),
    data: input.data,
    createdAt: existing?.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + WORKSPACE_DRAFT_TTL_MS).toISOString(),
  };
  const next = [draft as WorkspaceDraft, ...all.filter((item) => item.id !== id)]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, MAX_DRAFTS);
  writeRaw(next);
  return draft;
}

export function deleteWorkspaceDraft(id: string) {
  const next = listWorkspaceDrafts().filter((item) => item.id !== id);
  writeRaw(next);
}

export function workspaceDraftHref(draft: Pick<WorkspaceDraft, "id" | "workspace">) {
  const path = draft.workspace === "studio" ? "/studio" : draft.workspace === "series" ? "/series" : "/agent";
  return `${path}?draft=${encodeURIComponent(draft.id)}`;
}

export function workspaceDraftLabel(workspace: WorkspaceDraftKind) {
  return workspace === "studio" ? "AI Studio" : workspace === "series" ? "Series Studio" : "AI Planner";
}

export function remainingDraftMs(draft: Pick<WorkspaceDraft, "expiresAt">) {
  return Math.max(0, Date.parse(draft.expiresAt) - Date.now());
}

export function useWorkspaceDraftAutosave<T>(input: {
  workspace: WorkspaceDraftKind;
  title: string;
  data: T;
  shouldSave: boolean;
  onRestore: (data: T) => void;
  debounceMs?: number;
}) {
  const draftIdRef = useRef("");
  const lastSavedSignatureRef = useRef("");
  const initializedRef = useRef(false);
  const restoringRef = useRef(false);
  const dataRef = useRef(input.data);
  const restoreRef = useRef(input.onRestore);

  dataRef.current = input.data;
  restoreRef.current = input.onRestore;

  useEffect(() => {
    let active = true;
    const initialize = () => {
      if (!active || !getWorkspaceDraftScope() || initializedRef.current) return;
      const requestedId = new URLSearchParams(window.location.search).get("draft") || "";
      if (requestedId) {
        const draft = readWorkspaceDraft<T>(requestedId);
        if (draft?.workspace === input.workspace) {
          draftIdRef.current = draft.id;
          lastSavedSignatureRef.current = JSON.stringify(draft.data);
          restoringRef.current = true;
          restoreRef.current(draft.data);
          window.setTimeout(() => { restoringRef.current = false; }, 350);
        }
      }
      if (!lastSavedSignatureRef.current) lastSavedSignatureRef.current = JSON.stringify(dataRef.current);
      initializedRef.current = true;
    };
    initialize();
    window.addEventListener(WORKSPACE_DRAFT_SCOPE_READY_EVENT, initialize);
    return () => {
      active = false;
      window.removeEventListener(WORKSPACE_DRAFT_SCOPE_READY_EVENT, initialize);
    };
  }, [input.workspace]);

  useEffect(() => {
    if (!initializedRef.current || restoringRef.current || !input.shouldSave || !getWorkspaceDraftScope()) return;
    const signature = JSON.stringify(input.data);
    if (signature === lastSavedSignatureRef.current) return;
    const timer = window.setTimeout(() => {
      if (restoringRef.current) return;
      const saved = saveWorkspaceDraft({
        id: draftIdRef.current || undefined,
        workspace: input.workspace,
        title: input.title,
        data: input.data,
      });
      if (!saved) return;
      draftIdRef.current = saved.id;
      lastSavedSignatureRef.current = signature;
      const url = new URL(window.location.href);
      if (url.searchParams.get("draft") !== saved.id) {
        url.searchParams.set("draft", saved.id);
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      }
    }, input.debounceMs ?? 1200);
    return () => window.clearTimeout(timer);
  }, [input.data, input.debounceMs, input.shouldSave, input.title, input.workspace]);

  return { draftIdRef };
}
