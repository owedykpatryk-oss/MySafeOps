import { useEffect, useRef, useState } from "react";
import { getSoroEmbedSrc } from "./soroBlogConfig.js";

const SORO_SCRIPT_ID = "soro-blog-embed-script";

function injectSoroPreconnect() {
  if (document.querySelector('link[data-soro-preconnect="1"]')) return;
  const l = document.createElement("link");
  l.rel = "preconnect";
  l.href = "https://app.trysoro.com";
  l.setAttribute("data-soro-preconnect", "1");
  document.head.appendChild(l);
}

/**
 * Soro embed script runs an IIFE that requires `#soro-blog` in the DOM.
 * We lazy-load when the section is near the viewport, with an idle timeout fallback.
 * On SPA remount, any previous script node is removed so the embed can initialise again.
 */
export default function LandingSoroBlog() {
  const sectionRef = useRef(null);
  const loadingRef = useRef(false);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;

    const mount = () => document.getElementById("soro-blog");

    const runEmbed = () => {
      if (loadingRef.current) return;
      const el = mount();
      if (!el) {
        setStatus("error");
        return;
      }
      loadingRef.current = true;
      setStatus("loading");
      injectSoroPreconnect();

      const prev = document.getElementById(SORO_SCRIPT_ID);
      if (prev) prev.remove();

      const s = document.createElement("script");
      s.id = SORO_SCRIPT_ID;
      s.src = getSoroEmbedSrc(import.meta.env);
      s.defer = true;
      s.async = true;
      s.onerror = () => {
        loadingRef.current = false;
        setStatus("error");
      };
      s.onload = () => {
        setStatus("ready");
      };
      document.body.appendChild(s);
    };

    let cancelled = false;
    const safeRun = () => {
      if (cancelled) return;
      runEmbed();
    };

    let idleHandle = null;
    let timeoutHandle = null;
    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(() => safeRun(), { timeout: 5000 });
    } else {
      timeoutHandle = window.setTimeout(safeRun, 4000);
    }

    let io = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            safeRun();
            io?.disconnect();
          }
        },
        { root: null, rootMargin: "160px 0px", threshold: 0.01 }
      );
      io.observe(section);
    } else {
      safeRun();
    }

    return () => {
      cancelled = true;
      io?.disconnect();
      if (idleHandle != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle != null) {
        clearTimeout(timeoutHandle);
      }
      document.getElementById(SORO_SCRIPT_ID)?.remove();
      loadingRef.current = false;
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="soro-blog"
      id="blog"
      aria-labelledby="soro-blog-heading"
      aria-busy={status === "loading"}
    >
      <div className="ctn">
        <div className="sh fu">
          <div className="badge" style={{ background: "rgba(6,182,212,.12)", color: "#0e7490" }}>
            Updates
          </div>
          <h2 id="soro-blog-heading">From the blog</h2>
          <p>Product notes, safety thinking, and what we are shipping next.</p>
        </div>
        <div className="soro-blog-host">
          <div id="soro-blog" />
          {status === "error" && (
            <p className="soro-blog-fallback" role="status">
              The blog could not load (network, firewall, or content blocker). Allow <strong>app.trysoro.com</strong> or try
              again later.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
