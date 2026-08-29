"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./users.module.css";

type Member = {
  id: string;
  name: string;
  email: string;
  role: "MEMBER";
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  twoFactorEnabled: boolean;
  balance: { paid: number; bonus: number; reserved: number; available: number };
  suspendedUntil: string | null;
  suspensionReason: string | null;
  restriction: string | null;
};

type ActivityItem = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  createdAt: string;
};

type MemberFilter = "ALL" | "ACTIVE" | "BLOCKED";
type DetailTab = "PROFILE" | "CREDIT" | "ACCESS" | "ACTIVITY";
type Notice = { tone: "success" | "error" | "info"; text: string };
type IconName =
  | "activity"
  | "arrow"
  | "ban"
  | "calendar"
  | "check"
  | "close"
  | "credit"
  | "eye"
  | "eyeOff"
  | "key"
  | "plus"
  | "search"
  | "shield"
  | "trash"
  | "user"
  | "users";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "activity":
      return (
        <svg {...common}>
          <path d="M3 12h4l2-6 4 12 2-6h6" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="m14 7 5 5-5 5" />
        </svg>
      );
    case "ban":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m6 6 12 12" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );
    case "credit":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M3 10h18M7 15h3" />
        </svg>
      );
    case "eye":
      return (
        <svg {...common}>
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case "eyeOff":
      return (
        <svg {...common}>
          <path d="m3 3 18 18" />
          <path d="M10.6 6.2A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a15 15 0 0 1-2.1 2.7" />
          <path d="M6.6 6.7C4 8.4 2.5 12 2.5 12s3.5 6 9.5 6c1.2 0 2.3-.2 3.3-.6" />
        </svg>
      );
    case "key":
      return (
        <svg {...common}>
          <circle cx="8" cy="15" r="4" />
          <path d="m11 12 8-8M16 7l2 2" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3Z" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
  }
}

function when(value: string | null) {
  if (!value) return "ยังไม่มีข้อมูล";
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function initials(member: Pick<Member, "name" | "email">) {
  const value = member.name.trim() || member.email.trim();
  return value.slice(0, 2).toLocaleUpperCase("th-TH");
}

function stateOf(member: Member) {
  const suspended =
    member.suspendedUntil && new Date(member.suspendedUntil).getTime() > Date.now();
  if (suspended) return { label: "ระงับชั่วคราว", tone: "suspended" as const };
  if (!member.active) return { label: "บล็อก", tone: "blocked" as const };
  return { label: "ใช้งานได้", tone: "active" as const };
}

const TABS: Array<{ id: DetailTab; label: string; icon: IconName }> = [
  { id: "PROFILE", label: "ข้อมูลบัญชี", icon: "user" },
  { id: "CREDIT", label: "เครดิต", icon: "credit" },
  { id: "ACCESS", label: "การเข้าถึง", icon: "shield" },
  { id: "ACTIVITY", label: "Activity", icon: "activity" },
];

export default function AdminUsersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [logs, setLogs] = useState<ActivityItem[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemberFilter>("ALL");
  const [detailTab, setDetailTab] = useState<DetailTab>("PROFILE");
  const [showCreate, setShowCreate] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    password: "",
    creditDelta: "",
    suspendMinutes: "",
    reason: "",
  });

  const selected = useMemo(
    () => members.find((member) => member.id === selectedId) || null,
    [members, selectedId],
  );

  const stats = useMemo(() => {
    const active = members.filter((member) => stateOf(member).tone === "active").length;
    const restricted = members.length - active;
    const credits = members.reduce(
      (total, member) => total + member.balance.available,
      0,
    );
    return { active, restricted, credits };
  }, [members]);

  const filteredMembers = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("th-TH");
    return members.filter((member) => {
      const state = stateOf(member);
      const matchesFilter =
        filter === "ALL" ||
        (filter === "ACTIVE" && state.tone === "active") ||
        (filter === "BLOCKED" && state.tone !== "active");
      if (!matchesFilter) return false;
      if (!needle) return true;
      return `${member.name} ${member.email} ${state.label}`
        .toLocaleLowerCase("th-TH")
        .includes(needle);
    });
  }, [filter, members, query]);

  function announce(text: string, tone: Notice["tone"] = "info") {
    setNotice({ text, tone });
  }

  async function loadMembers(preferredId?: string) {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/members", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        announce(
          response.status === 403
            ? "หน้านี้สำหรับ Administrator เท่านั้น"
            : data.error || "โหลดสมาชิกไม่สำเร็จ",
          "error",
        );
        return;
      }
      const nextMembers: Member[] = data.members || [];
      setMembers(nextMembers);
      const currentStillExists = nextMembers.some((member) => member.id === selectedId);
      setSelectedId(
        preferredId ||
          (currentStillExists ? selectedId : "") ||
          nextMembers[0]?.id ||
          "",
      );
    } catch {
      announce("ไม่สามารถเชื่อมต่อเพื่อโหลดบัญชีผู้ใช้ได้", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs(userId: string) {
    if (!userId) {
      setLogs([]);
      return;
    }
    try {
      const response = await fetch(
        `/api/admin/members/logs?userId=${encodeURIComponent(userId)}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      setLogs(response.ok ? data.items || [] : []);
    } catch {
      setLogs([]);
    }
  }

  useEffect(() => {
    void loadMembers();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setEditForm({
      name: selected.name,
      email: selected.email,
      password: "",
      creditDelta: "",
      suspendMinutes: "",
      reason: selected.suspensionReason || "",
    });
    setShowResetPassword(false);
    void loadLogs(selected.id);
  }, [selected?.id]);

  async function mutate(
    body: Record<string, unknown>,
    success: string,
  ): Promise<boolean> {
    if (!selected) return false;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, ...body }),
      });
      const data = await response.json();
      if (!response.ok) {
        announce(data.error || "ดำเนินการไม่สำเร็จ", "error");
        return false;
      }
      announce(success, "success");
      await loadMembers(selected.id);
      await loadLogs(selected.id);
      return true;
    } catch {
      announce("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อดำเนินการได้", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createMember(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await response.json();
      if (!response.ok) {
        announce(data.error || "สร้างสมาชิกไม่สำเร็จ", "error");
        return;
      }
      setCreateForm({ name: "", email: "", password: "" });
      setShowCreate(false);
      setShowCreatePassword(false);
      setDetailTab("PROFILE");
      announce("สร้างบัญชีสมาชิกเรียบร้อยแล้ว", "success");
      await loadMembers(data.member?.id);
    } catch {
      announce("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อสร้างสมาชิกได้", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    const updated = await mutate(
      {
        name: editForm.name,
        email: editForm.email,
        password: editForm.password || undefined,
      },
      editForm.password
        ? "บันทึกข้อมูลและตั้งรหัสผ่านใหม่แล้ว"
        : "บันทึกข้อมูลบัญชีแล้ว",
    );
    if (updated) {
      setEditForm((value) => ({ ...value, password: "" }));
      setShowResetPassword(false);
    }
  }

  async function adjustCredits() {
    const delta = Math.trunc(Number(editForm.creditDelta));
    if (!Number.isFinite(delta) || delta === 0) {
      announce("ใส่จำนวนเครดิตที่ต้องการปรับ เช่น 500 หรือ -100", "error");
      return;
    }
    const updated = await mutate(
      { creditDelta: delta },
      `ปรับเครดิต ${delta > 0 ? "+" : ""}${delta.toLocaleString("th-TH")} เรียบร้อยแล้ว`,
    );
    if (updated) setEditForm((value) => ({ ...value, creditDelta: "" }));
  }

  async function suspend(minutes: number) {
    if (!selected) return;
    const label =
      minutes < 60
        ? `${minutes} นาที`
        : minutes < 1440
          ? `${minutes / 60} ชั่วโมง`
          : `${minutes / 1440} วัน`;
    if (!window.confirm(`ระงับ ${selected.email} เป็นเวลา ${label} ใช่หรือไม่?`)) {
      return;
    }
    await mutate(
      {
        suspendMinutes: minutes,
        suspensionReason: editForm.reason || "Admin suspension",
      },
      `ระงับการใช้งาน ${label} แล้ว`,
    );
  }

  async function suspendCustom() {
    const minutes = Math.trunc(Number(editForm.suspendMinutes));
    if (!Number.isFinite(minutes) || minutes < 1) {
      announce("กรุณาระบุจำนวนนาทีที่ถูกต้อง", "error");
      return;
    }
    await suspend(minutes);
  }

  async function blockForever() {
    if (
      !selected ||
      !window.confirm(
        `บล็อกบัญชี ${selected.email} จนกว่า Administrator จะปลดเองใช่หรือไม่?`,
      )
    ) {
      return;
    }
    await mutate(
      { active: false, suspensionReason: editForm.reason || "Admin block" },
      "บล็อกบัญชีแล้ว",
    );
  }

  async function unblock() {
    if (!selected) return;
    await mutate({ active: true }, "ปลดข้อจำกัดและเปิดใช้งานบัญชีแล้ว");
  }

  async function deleteMember() {
    if (!selected) return;
    const typed = window.prompt(
      `การลบจะลบข้อมูล Project, Job และ Wallet ที่ผูกกับบัญชี\nพิมพ์ DELETE เพื่อยืนยันการลบ ${selected.email}`,
    );
    if (typed !== "DELETE") return;

    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        announce(data.error || "ลบบัญชีไม่สำเร็จ", "error");
        return;
      }
      announce(`ลบบัญชี ${selected.email} แล้ว`, "success");
      setSelectedId("");
      setLogs([]);
      await loadMembers();
    } catch {
      announce("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อลบบัญชีได้", "error");
    } finally {
      setBusy(false);
    }
  }

  function chooseMember(id: string) {
    setSelectedId(id);
    setDetailTab("PROFILE");
    setNotice(null);
  }

  const selectedState = selected ? stateOf(selected) : null;

  return (
    <main className={styles.page} data-keep-small>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>USER MANAGEMENT</span>
          <h1>จัดการผู้ใช้งาน</h1>
          <p>
            ค้นหาและดูแลบัญชีสมาชิกจากจุดเดียว
            ทุกการเปลี่ยนแปลงสำคัญจะถูกบันทึกใน Activity ของผู้ใช้
          </p>
        </div>
        <div className={styles.overview}>
          <div>
            <span className={styles.overviewIcon}>
              <Icon name="users" />
            </span>
            <span>
              <small>บัญชีทั้งหมด</small>
              <strong>{members.length}</strong>
            </span>
          </div>
          <div>
            <span className={`${styles.overviewIcon} ${styles.iconSuccess}`}>
              <Icon name="check" />
            </span>
            <span>
              <small>ใช้งานได้</small>
              <strong>{stats.active}</strong>
            </span>
          </div>
          <div>
            <span className={`${styles.overviewIcon} ${styles.iconWarning}`}>
              <Icon name="ban" />
            </span>
            <span>
              <small>ถูกจำกัด</small>
              <strong>{stats.restricted}</strong>
            </span>
          </div>
          <div>
            <span className={styles.overviewIcon}>
              <Icon name="credit" />
            </span>
            <span>
              <small>เครดิตพร้อมใช้รวม</small>
              <strong>{stats.credits.toLocaleString("th-TH")}</strong>
            </span>
          </div>
        </div>
      </header>

      {notice ? (
        <div
          className={`${styles.notice} ${styles[`notice${notice.tone[0].toUpperCase()}${notice.tone.slice(1)}`]}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          <span>
            {notice.tone === "success" ? (
              <Icon name="check" />
            ) : notice.tone === "error" ? (
              <Icon name="ban" />
            ) : (
              <Icon name="activity" />
            )}
          </span>
          <p>{notice.text}</p>
          <button type="button" onClick={() => setNotice(null)} aria-label="ปิดข้อความ">
            <Icon name="close" size={16} />
          </button>
        </div>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.directory}>
          <div className={styles.directoryHeader}>
            <div>
              <span className={styles.eyebrow}>MEMBER DIRECTORY</span>
              <h2>บัญชีสมาชิก</h2>
            </div>
            <button
              className={styles.addButton}
              type="button"
              onClick={() => setShowCreate((current) => !current)}
              aria-expanded={showCreate}
            >
              {showCreate ? <Icon name="close" /> : <Icon name="plus" />}
              {showCreate ? "ปิด" : "เพิ่มผู้ใช้"}
            </button>
          </div>

          {showCreate ? (
            <form className={styles.createCard} onSubmit={createMember}>
              <div className={styles.createTitle}>
                <span className={styles.createIcon}>
                  <Icon name="user" />
                </span>
                <span>
                  <strong>สร้างบัญชีสมาชิก</strong>
                  <small>ระบบจะสร้างบัญชีประเภท Member</small>
                </span>
              </div>
              <label className={styles.field}>
                <span>ชื่อที่แสดง</span>
                <input
                  className={styles.input}
                  value={createForm.name}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, name: event.target.value })
                  }
                  placeholder="เช่น Anan Studio"
                  required
                />
              </label>
              <label className={styles.field}>
                <span>อีเมล</span>
                <input
                  className={styles.input}
                  type="email"
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, email: event.target.value })
                  }
                  placeholder="name@example.com"
                  required
                />
              </label>
              <label className={styles.field}>
                <span>รหัสผ่านเริ่มต้น</span>
                <div className={styles.passwordField}>
                  <Icon name="key" size={17} />
                  <input
                    type={showCreatePassword ? "text" : "password"}
                    minLength={8}
                    value={createForm.password}
                    onChange={(event) =>
                      setCreateForm({ ...createForm, password: event.target.value })
                    }
                    placeholder="อย่างน้อย 8 ตัวอักษร"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword((current) => !current)}
                    aria-label={showCreatePassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  >
                    <Icon name={showCreatePassword ? "eyeOff" : "eye"} size={17} />
                  </button>
                </div>
              </label>
              <button className={styles.primaryButton} disabled={busy} type="submit">
                {busy ? "กำลังสร้าง..." : "สร้างบัญชีสมาชิก"}
                {!busy ? <Icon name="arrow" size={17} /> : null}
              </button>
            </form>
          ) : null}

          <div className={styles.searchArea}>
            <div className={styles.searchBox}>
              <Icon name="search" size={17} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นหาชื่อหรืออีเมล..."
                aria-label="ค้นหาผู้ใช้งาน"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} aria-label="ล้างคำค้น">
                  <Icon name="close" size={15} />
                </button>
              ) : null}
            </div>
            <div className={styles.filters} role="group" aria-label="กรองสถานะบัญชี">
              {(
                [
                  ["ALL", "ทั้งหมด"],
                  ["ACTIVE", "ใช้งานได้"],
                  ["BLOCKED", "ถูกจำกัด"],
                ] as Array<[MemberFilter, string]>
              ).map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  className={filter === id ? styles.filterActive : ""}
                  onClick={() => setFilter(id)}
                  aria-pressed={filter === id}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.listMeta}>
            <span>ผลลัพธ์ {filteredMembers.length} บัญชี</span>
            {query || filter !== "ALL" ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("ALL");
                }}
              >
                ล้างตัวกรอง
              </button>
            ) : null}
          </div>

          <div className={styles.memberList}>
            {loading ? (
              <div className={styles.loadingList}>
                <span />
                <span />
                <span />
              </div>
            ) : filteredMembers.length ? (
              filteredMembers.map((member) => {
                const memberState = stateOf(member);
                return (
                  <button
                    type="button"
                    key={member.id}
                    className={`${styles.memberCard} ${
                      selectedId === member.id ? styles.memberSelected : ""
                    }`}
                    onClick={() => chooseMember(member.id)}
                    aria-pressed={selectedId === member.id}
                  >
                    <span className={styles.avatar}>{initials(member)}</span>
                    <span className={styles.memberCopy}>
                      <strong>{member.name}</strong>
                      <small>{member.email}</small>
                      <span className={styles.memberFoot}>
                        <span
                          className={`${styles.statusDot} ${styles[memberState.tone]}`}
                        >
                          <i aria-hidden="true" />
                          {memberState.label}
                        </span>
                        <span>{member.balance.available.toLocaleString("th-TH")} เครดิต</span>
                      </span>
                    </span>
                    <span className={styles.memberArrow}>
                      <Icon name="arrow" size={16} />
                    </span>
                  </button>
                );
              })
            ) : (
              <div className={styles.emptyList}>
                <span>
                  <Icon name="search" />
                </span>
                <strong>ไม่พบบัญชี</strong>
                <p>ลองเปลี่ยนคำค้นหรือตัวกรองสถานะ</p>
              </div>
            )}
          </div>
        </aside>

        <section className={styles.detailPanel}>
          {selected && selectedState ? (
            <>
              <header className={styles.accountHeader}>
                <div className={styles.accountIdentity}>
                  <span className={styles.avatarLarge}>{initials(selected)}</span>
                  <span>
                    <span className={styles.accountMeta}>
                      <span
                        className={`${styles.accountStatus} ${styles[selectedState.tone]}`}
                      >
                        <i aria-hidden="true" />
                        {selectedState.label}
                      </span>
                      {selected.twoFactorEnabled ? (
                        <span className={styles.twoFactor}>
                          <Icon name="shield" size={13} />
                          2FA
                        </span>
                      ) : null}
                    </span>
                    <h2>{selected.name}</h2>
                    <p>{selected.email}</p>
                  </span>
                </div>
                <div className={styles.accountDates}>
                  <span>
                    <Icon name="calendar" size={15} />
                    สร้างเมื่อ {when(selected.createdAt)}
                  </span>
                  <span>
                    <Icon name="activity" size={15} />
                    เข้าสู่ระบบล่าสุด {when(selected.lastLoginAt)}
                  </span>
                </div>
              </header>

              <div className={styles.metrics}>
                <div>
                  <span className={styles.metricIcon}>
                    <Icon name="credit" />
                  </span>
                  <span>
                    <small>เครดิตพร้อมใช้</small>
                    <strong>{selected.balance.available.toLocaleString("th-TH")}</strong>
                  </span>
                </div>
                <div>
                  <span>
                    <small>เครดิตที่ซื้อ</small>
                    <strong>{selected.balance.paid.toLocaleString("th-TH")}</strong>
                  </span>
                </div>
                <div>
                  <span>
                    <small>โบนัส</small>
                    <strong>{selected.balance.bonus.toLocaleString("th-TH")}</strong>
                  </span>
                </div>
                <div>
                  <span>
                    <small>เครดิตสำรอง</small>
                    <strong>{selected.balance.reserved.toLocaleString("th-TH")}</strong>
                  </span>
                </div>
              </div>

              <nav className={styles.detailTabs} aria-label="เครื่องมือจัดการบัญชี">
                {TABS.map((tab) => (
                  <button
                    type="button"
                    key={tab.id}
                    className={detailTab === tab.id ? styles.tabActive : ""}
                    onClick={() => setDetailTab(tab.id)}
                    aria-current={detailTab === tab.id ? "page" : undefined}
                  >
                    <Icon name={tab.icon} size={16} />
                    {tab.label}
                    {tab.id === "ACTIVITY" ? <span>{logs.length}</span> : null}
                  </button>
                ))}
              </nav>

              <div className={styles.detailBody}>
                {detailTab === "PROFILE" ? (
                  <section className={styles.toolSection}>
                    <div className={styles.sectionHeading}>
                      <div>
                        <span className={styles.eyebrow}>ACCOUNT PROFILE</span>
                        <h3>ข้อมูลบัญชี</h3>
                        <p>แก้ไขชื่อ อีเมล หรือกำหนดรหัสผ่านใหม่ให้สมาชิก</p>
                      </div>
                    </div>
                    <form className={styles.profileForm} onSubmit={saveProfile}>
                      <div className={styles.grid2}>
                        <label className={styles.field}>
                          <span>ชื่อที่แสดง</span>
                          <input
                            className={styles.input}
                            value={editForm.name}
                            onChange={(event) =>
                              setEditForm({ ...editForm, name: event.target.value })
                            }
                            required
                          />
                        </label>
                        <label className={styles.field}>
                          <span>อีเมล</span>
                          <input
                            className={styles.input}
                            type="email"
                            value={editForm.email}
                            onChange={(event) =>
                              setEditForm({ ...editForm, email: event.target.value })
                            }
                            required
                          />
                        </label>
                      </div>
                      <label className={styles.field}>
                        <span>ตั้งรหัสผ่านใหม่</span>
                        <div className={styles.passwordField}>
                          <Icon name="key" size={17} />
                          <input
                            type={showResetPassword ? "text" : "password"}
                            minLength={8}
                            value={editForm.password}
                            onChange={(event) =>
                              setEditForm({ ...editForm, password: event.target.value })
                            }
                            placeholder="เว้นว่างไว้หากไม่ต้องการเปลี่ยน"
                          />
                          <button
                            type="button"
                            onClick={() => setShowResetPassword((current) => !current)}
                            aria-label={showResetPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                          >
                            <Icon name={showResetPassword ? "eyeOff" : "eye"} size={17} />
                          </button>
                        </div>
                        <small>การเปลี่ยนรหัสผ่านจะถูกบันทึกใน Activity ของบัญชี</small>
                      </label>
                      <div className={styles.formActions}>
                        <button className={styles.primaryButton} disabled={busy} type="submit">
                          {busy ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
                        </button>
                      </div>
                    </form>
                  </section>
                ) : null}

                {detailTab === "CREDIT" ? (
                  <section className={styles.toolSection}>
                    <div className={styles.sectionHeading}>
                      <div>
                        <span className={styles.eyebrow}>CREDIT CONTROL</span>
                        <h3>ปรับเครดิตผู้ใช้</h3>
                        <p>ใช้ค่าบวกเพื่อเพิ่มเครดิต และค่าลบเพื่อหักเครดิต</p>
                      </div>
                      <div className={styles.balanceCard}>
                        <small>ยอดพร้อมใช้ปัจจุบัน</small>
                        <strong>{selected.balance.available.toLocaleString("th-TH")}</strong>
                        <span>เครดิต</span>
                      </div>
                    </div>
                    <div className={styles.quickCredits}>
                      {[100, 500, 1000, -100].map((amount) => (
                        <button
                          type="button"
                          key={amount}
                          onClick={() =>
                            setEditForm({
                              ...editForm,
                              creditDelta: String(amount),
                            })
                          }
                        >
                          {amount > 0 ? "+" : ""}
                          {amount.toLocaleString("th-TH")}
                        </button>
                      ))}
                    </div>
                    <div className={styles.creditEditor}>
                      <label className={styles.field}>
                        <span>จำนวนที่ต้องการปรับ</span>
                        <div className={styles.amountField}>
                          <Icon name="credit" size={18} />
                          <input
                            inputMode="numeric"
                            value={editForm.creditDelta}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                creditDelta: event.target.value,
                              })
                            }
                            placeholder="เช่น 500 หรือ -100"
                          />
                          <span>เครดิต</span>
                        </div>
                      </label>
                      <button
                        className={styles.primaryButton}
                        type="button"
                        onClick={() => void adjustCredits()}
                        disabled={busy}
                      >
                        {busy ? "กำลังปรับ..." : "ยืนยันการปรับเครดิต"}
                      </button>
                    </div>
                    <div className={styles.auditNote}>
                      <Icon name="activity" />
                      <p>
                        <strong>ทุกการปรับเครดิตมี Audit trail</strong>
                        ระบบจะบันทึกจำนวน ผู้ดำเนินการ และเวลาไว้ใน Activity
                      </p>
                    </div>
                  </section>
                ) : null}

                {detailTab === "ACCESS" ? (
                  <section className={styles.toolSection}>
                    <div className={styles.sectionHeading}>
                      <div>
                        <span className={styles.eyebrow}>ACCESS CONTROL</span>
                        <h3>ระงับหรือบล็อกบัญชี</h3>
                        <p>กำหนดเหตุผลและช่วงเวลาที่ต้องการจำกัดการเข้าใช้งาน</p>
                      </div>
                      {selected.suspendedUntil ? (
                        <div className={styles.suspensionCard}>
                          <small>ระงับถึง</small>
                          <strong>{when(selected.suspendedUntil)}</strong>
                        </div>
                      ) : null}
                    </div>
                    <label className={styles.field}>
                      <span>เหตุผลสำหรับบันทึกใน Activity</span>
                      <textarea
                        className={styles.textarea}
                        value={editForm.reason}
                        onChange={(event) =>
                          setEditForm({ ...editForm, reason: event.target.value })
                        }
                        placeholder="ระบุเหตุผลที่ทีม Administrator เข้าใจตรงกัน"
                      />
                    </label>
                    <div className={styles.durationGrid}>
                      {[
                        [15, "15 นาที"],
                        [60, "1 ชั่วโมง"],
                        [1440, "1 วัน"],
                        [10080, "7 วัน"],
                      ].map(([minutes, label]) => (
                        <button
                          type="button"
                          key={minutes}
                          onClick={() => void suspend(Number(minutes))}
                          disabled={busy}
                        >
                          <Icon name="calendar" size={16} />
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className={styles.customDuration}>
                      <div className={styles.amountField}>
                        <Icon name="calendar" size={18} />
                        <input
                          inputMode="numeric"
                          value={editForm.suspendMinutes}
                          onChange={(event) =>
                            setEditForm({
                              ...editForm,
                              suspendMinutes: event.target.value,
                            })
                          }
                          placeholder="กำหนดระยะเวลาเอง"
                        />
                        <span>นาที</span>
                      </div>
                      <button
                        className={styles.secondaryButton}
                        type="button"
                        onClick={() => void suspendCustom()}
                        disabled={busy}
                      >
                        ระงับตามเวลานี้
                      </button>
                      <button
                        className={styles.blockButton}
                        type="button"
                        onClick={() => void blockForever()}
                        disabled={busy}
                      >
                        <Icon name="ban" size={16} />
                        บล็อกจนกว่าจะปลด
                      </button>
                    </div>
                    {selectedState.tone !== "active" ? (
                      <div className={styles.unblockBar}>
                        <span>
                          <Icon name="shield" />
                          <span>
                            <strong>บัญชีนี้ถูกจำกัดการเข้าถึง</strong>
                            <small>กดปลดข้อจำกัดเพื่อให้ผู้ใช้กลับเข้าสู่ระบบได้</small>
                          </span>
                        </span>
                        <button
                          className={styles.primaryButton}
                          type="button"
                          onClick={() => void unblock()}
                          disabled={busy}
                        >
                          ปลดข้อจำกัด
                        </button>
                      </div>
                    ) : null}
                    <div className={styles.dangerZone}>
                      <div>
                        <span className={styles.dangerIcon}>
                          <Icon name="trash" />
                        </span>
                        <span>
                          <strong>ลบบัญชีผู้ใช้</strong>
                          <small>
                            ลบข้อมูลที่เชื่อมโยงตาม Database relation และไม่สามารถย้อนกลับได้
                          </small>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void deleteMember()}
                        disabled={busy}
                      >
                        ลบบัญชี
                      </button>
                    </div>
                  </section>
                ) : null}

                {detailTab === "ACTIVITY" ? (
                  <section className={styles.toolSection}>
                    <div className={styles.sectionHeading}>
                      <div>
                        <span className={styles.eyebrow}>USER ACTIVITY</span>
                        <h3>ประวัติการดำเนินการ</h3>
                        <p>รายการล่าสุดที่เกี่ยวข้องกับบัญชีนี้</p>
                      </div>
                      <span className={styles.logCount}>{logs.length} รายการ</span>
                    </div>
                    {logs.length ? (
                      <div className={styles.timeline}>
                        {logs.map((log) => (
                          <article className={styles.logItem} key={log.id}>
                            <span className={styles.logMarker}>
                              <Icon name="activity" size={15} />
                            </span>
                            <div>
                              <div className={styles.logHeader}>
                                <span className={styles.logKind}>{log.kind}</span>
                                <time>{when(log.createdAt)}</time>
                              </div>
                              <strong>{log.title}</strong>
                              {log.detail ? <p>{log.detail}</p> : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.emptyActivity}>
                        <span>
                          <Icon name="activity" />
                        </span>
                        <strong>ยังไม่มี Activity</strong>
                        <p>เมื่อมีการแก้ไขบัญชี รายการจะปรากฏที่นี่</p>
                      </div>
                    )}
                  </section>
                ) : null}
              </div>
            </>
          ) : (
            <div className={styles.emptyDetail}>
              <span>
                <Icon name="user" size={26} />
              </span>
              <h2>เลือกบัญชีที่ต้องการจัดการ</h2>
              <p>เลือกรายชื่อจากด้านซ้ายเพื่อดูข้อมูล เครดิต การเข้าถึง และ Activity</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
