"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./portal.module.css";

type Me = { authenticated: boolean; name?: string; role?: "ADMIN" | "MEMBER"; twoFactorEnabled?: boolean };

export default function PortalPage() {
  const router = useRouter();
  const portalRef = useRef<HTMLElement>(null);
  const [me, setMe] = useState<Me>({ authenticated: false });
  const [ready, setReady] = useState(false);
  const [entering, setEntering] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

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

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)");
    const unsupported = !CSS.supports("transform-style", "preserve-3d");

    const syncFallback = () => {
      const shouldReduce = reduced.matches;
      setReduceMotion(shouldReduce);
      setUseFallback(shouldReduce || coarse.matches || window.innerWidth < 900 || unsupported);
    };

    syncFallback();
    reduced.addEventListener("change", syncFallback);
    coarse.addEventListener("change", syncFallback);
    window.addEventListener("resize", syncFallback, { passive: true });

    return () => {
      reduced.removeEventListener("change", syncFallback);
      coarse.removeEventListener("change", syncFallback);
      window.removeEventListener("resize", syncFallback);
    };
  }, []);

  useEffect(() => {
    const node = portalRef.current;
    if (!node || useFallback || reduceMotion) return;

    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;

    const paint = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const range = Math.max(1, node.offsetHeight - window.innerHeight);
      const progress = Math.max(0, Math.min(1, -rect.top / range));

      node.style.setProperty("--orbit-y", `${pointerX * 7.5}deg`);
      node.style.setProperty("--orbit-x", `${pointerY * -4.5}deg`);
      node.style.setProperty("--camera-z", `${progress * 150}px`);
      node.style.setProperty("--camera-y", `${progress * -42}px`);
      node.style.setProperty("--camera-pitch", `${progress * 3.6}deg`);
      node.style.setProperty("--hero-drift", `${progress * -34}px`);
      node.style.setProperty("--panel-drift", `${progress * 28}px`);
      node.style.setProperty("--scene-fade", `${1 - progress * 0.28}`);
    };

    const queuePaint = () => {
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointerX = (event.clientX / window.innerWidth - 0.5) * 2;
      pointerY = (event.clientY / window.innerHeight - 0.5) * 2;
      queuePaint();
    };

    const onPointerLeave = () => {
      pointerX = 0;
      pointerY = 0;
      queuePaint();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });
    window.addEventListener("scroll", queuePaint, { passive: true });
    paint();

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", queuePaint);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [useFallback, reduceMotion]);

  function enter() {
    if (!ready || entering) return;
    setEntering(true);
    window.setTimeout(() => router.push("/studio"), 260);
  }

  return (
    <main
      ref={portalRef}
      className={`${styles.portal} ${useFallback ? styles.fallbackMode : ""} ${entering ? styles.entering : ""}`}
      onClick={enter}
    >
      <div className={styles.stage}>
        <div className={styles.baseFallback} aria-hidden />

        {useFallback && !reduceMotion ? (
          <video className={styles.video} autoPlay muted loop playsInline preload="metadata" aria-hidden>
            <source src="/media/scenova-portal.mp4" type="video/mp4" />
          </video>
        ) : null}

        {!useFallback ? (
          <div className={styles.scene} aria-hidden>
            <div className={styles.camera}>
              <div className={styles.starField} />
              <div className={styles.blueHalo} />
              <div className={styles.goldHalo} />
              <div className={styles.horizon} />
              <div className={styles.floorGrid} />
              <div className={styles.orbitSystem}>
                <span className={styles.orbitOne} />
                <span className={styles.orbitTwo} />
                <span className={styles.orbitThree} />
                <span className={styles.core} />
                <span className={styles.coreBeam} />
              </div>
              <div className={styles.monoliths}>
                <span /><span /><span /><span /><span />
              </div>
              <div className={styles.holoDeck}>
                <span className={styles.holoFrame} />
                <span className={styles.holoLine} />
                <span className={styles.holoPointOne} />
                <span className={styles.holoPointTwo} />
              </div>
              <div className={styles.dust} />
            </div>
          </div>
        ) : null}

        <div className={styles.scan} aria-hidden />
        <div className={styles.vignette} aria-hidden />

        <header className={styles.top}>
          <div className={styles.brand}>
            <span className={styles.logo} aria-hidden><i>S</i></span>
            <span><b>SCENOVA</b><small>AI CINEMATIC PRODUCTION STUDIO</small></span>
          </div>
          <div className={styles.secure}><span className={styles.dot} /> SECURE WORKSPACE • {me.twoFactorEnabled ? "2FA VERIFIED" : "SESSION VERIFIED"}</div>
        </header>

        <section className={styles.content} aria-labelledby="portal-title">
          <div className={styles.hero}>
            <span className={styles.eyebrow}><i /> SCENOVA / CINEMATIC SYSTEM ONLINE</span>
            <h1 id="portal-title"><span>Direct worlds.</span><br />Not prompts.</h1>
            <p>พื้นที่สร้างภาพยนตร์และซีรีส์ด้วย AI ที่รวมการวางเรื่อง การกำกับ Scene กล้อง เสียง ความต่อเนื่อง และ Multi-model Rendering ไว้ในระบบเดียว</p>
            <button
              type="button"
              className={styles.cta}
              onClick={(event) => { event.stopPropagation(); enter(); }}
              disabled={!ready || entering}
            >
              <span className={styles.ctaOrb}>↗</span>
              <span><b>{ready ? "Explore the Work" : "Verifying Workspace"}</b><small>{ready ? "เข้าสู่ SCENOVA Studio" : "กำลังตรวจสอบ Session"}</small></span>
              <i aria-hidden>SCN / 01</i>
            </button>
            <div className={styles.scrollCue} aria-hidden><span /> SCROLL TO MOVE THROUGH THE SCENE</div>
          </div>

          <aside className={styles.panel} aria-label="Workspace status">
            <div className={styles.panelGlow} aria-hidden />
            <div className={styles.panelHead}>
              <div><span>WORKSPACE STATUS</span><b>{me.name || "SCENOVA User"}</b></div>
              <div className={styles.ready}><i /> READY</div>
            </div>
            <div className={styles.stack}>
              <div><i>✦</i><span><b>AI Director</b><small>AI-assisted production planning</small></span><em>ONLINE</em></div>
              <div><i>▦</i><span><b>Scene Planner</b><small>Scene-by-scene direction</small></span><em>READY</em></div>
              <div><i>◆</i><span><b>Director Pro</b><small>Professional shot controls</small></span><em>READY</em></div>
              <div><i>EP</i><span><b>Series</b><small>Episode continuity workspace</small></span><em>SYNCED</em></div>
            </div>
            <div className={styles.telemetry}><span>AUTH</span><b>VERIFIED</b><span>LATENCY</span><b>LIVE</b><span>MODE</span><b>PRODUCTION</b></div>
          </aside>
        </section>

        <footer className={styles.footer}>
          <span>SCENOVA / SECURE CINEMATIC WORKSPACE</span>
          <span className={styles.coordinates}>13.7563° N · 100.5018° E / SYSTEM READY</span>
          <span>STUDIO • SERIES • ASSET LIBRARY • RENDER QUEUE</span>
        </footer>
      </div>
    </main>
  );
}
