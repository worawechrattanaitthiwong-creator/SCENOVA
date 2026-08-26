"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./portal.module.css";

type Me = { authenticated: boolean; name?: string; role?: "ADMIN" | "MEMBER"; twoFactorEnabled?: boolean };

export default function PortalPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me>({ authenticated: false });
  const [ready, setReady] = useState(false);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/auth/me?t=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Cache-Control": "no-cache" },
    })
      .then((response) => response.json())
      .then((data: Me) => {
        if (!alive) return;
        if (!data.authenticated) return router.replace("/login");
        setMe(data);
        setReady(true);
        router.prefetch("/studio");
        router.prefetch("/series");
        router.prefetch("/libraries");
        router.prefetch("/render");
        router.prefetch("/models");
      })
      .catch(() => router.replace("/login"));
    return () => { alive = false; };
  }, [router]);

  function enter() {
    if (!ready || entering) return;
    setEntering(true);
    window.setTimeout(() => router.push("/studio"), 260);
  }

  return (
    <main
      className={`${styles.portal} ${entering ? styles.entering : ""}`}
      onClick={enter}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") enter(); }}
      role="button"
      tabIndex={0}
      aria-label="Enter SCENOVA Studio"
    >
      <div className={styles.fallback} />
      <video className={styles.video} autoPlay muted loop playsInline preload="metadata" aria-hidden>
        <source src="/media/scenova-portal.mp4" type="video/mp4" />
      </video>
      <div className={styles.scan} />
      <div className={styles.shade} />

      <header className={styles.top}>
        <div className={styles.brand}><span className={styles.logo}>S</span><span><b>SCENOVA</b><small>AI CINEMATIC PRODUCTION STUDIO</small></span></div>
        <div className={styles.secure}><span className={styles.dot} /> SECURE WORKSPACE • {me.twoFactorEnabled ? "2FA VERIFIED" : "SESSION VERIFIED"}</div>
      </header>

      <section className={styles.content}>
        <div className={styles.hero}>
          <span className={styles.eyebrow}>PRODUCTION ENVIRONMENT / READY</span>
          <h1>Enter the<br />SCENOVA Studio</h1>
          <p>Professional AI production workspace for story development, scene direction, camera design, series continuity, prompt engineering and multi-model rendering.</p>
          <div className={styles.enterHint}><span className={styles.enterIcon}>→</span><span>{ready ? "CLICK ANYWHERE TO ENTER" : "VERIFYING WORKSPACE..."}</span></div>
        </div>

        <aside className={styles.panel}>
          <div className={styles.panelHead}><div><span>WORKSPACE STATUS</span><b>{me.name || "SCENOVA User"}</b></div><div className={styles.ready}>READY</div></div>
          <div className={styles.stack}>
            <div><i>✦</i><span><b>AI Director</b><small>Assisted production planning</small></span><em>ONLINE</em></div>
            <div><i>▦</i><span><b>Scene Planner</b><small>Scene-by-scene direction</small></span><em>READY</em></div>
            <div><i>◆</i><span><b>Director Pro</b><small>Professional shot controls</small></span><em>READY</em></div>
            <div><i>EP</i><span><b>Series</b><small>Episode continuity workspace</small></span><em>SYNCED</em></div>
          </div>
        </aside>
      </section>

      <footer className={styles.footer}><span>SCENOVA / SECURE CINEMATIC WORKSPACE</span><span>STUDIO • SERIES • ASSET LIBRARY • RENDER QUEUE</span></footer>
    </main>
  );
}
