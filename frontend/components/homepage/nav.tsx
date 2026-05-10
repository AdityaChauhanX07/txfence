"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const navLinks = [
  { label: "Docs", href: "/docs" },
  { label: "Playground", href: "/playground" },
  { label: "Pricing", href: "/pricing" },
];

// ─── Nav ──────────────────────────────────────────────────────────────────────

export function Nav() {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [visible, setVisible] = useState(!isHome);

  useEffect(() => {
    if (!isHome) {
      setVisible(true);
      return;
    }
    const t = setTimeout(() => setVisible(true), 3800);
    return () => clearTimeout(t);
  }, [isHome]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <>
      <style>{`
        .nav-link:hover { color: var(--color-text-secondary); }
      `}</style>

      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: "rgba(8, 8, 8, 0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--color-border-primary)",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(-8px)",
          transition: isHome ? "opacity 0.6s ease, transform 0.6s ease" : "none",
        }}
      >
        {/* Inner container */}
        <div
          style={{
            maxWidth: 640,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 52,
            padding: "0 1.5rem",
          }}
        >
          {/* Logo */}
          <a
            href="/"
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "var(--color-text-primary)",
            }}
          >
            <svg
              width="28"
              height="18"
              viewBox="0 0 28 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* t: vertical stem */}
              <rect x="5" y="1" width="2" height="16" rx="1" fill="currentColor"/>
              {/* t: crossbar */}
              <rect x="1" y="1" width="10" height="2" rx="1" fill="currentColor"/>
              {/* f: vertical stem */}
              <rect x="18" y="1" width="2" height="16" rx="1" fill="currentColor"/>
              {/* f: top bar */}
              <rect x="18" y="1" width="8" height="2" rx="1" fill="currentColor"/>
              {/* f: crossbar extended — the fence */}
              <rect x="14" y="9" width="12" height="2" rx="1" fill="currentColor"/>
            </svg>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 500, color: "var(--color-text-primary)" }}>
              txfence
            </span>
          </a>

          {/* Desktop right — all links clustered here */}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="nav-link"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--color-text-tertiary)",
                    textDecoration: "none",
                    transition: "color 0.15s ease",
                  }}
                >
                  {link.label.toLowerCase()}
                </a>
              ))}
              <a
                href="https://github.com/AdityaChauhanX07/txfence"
                target="_blank"
                rel="noopener noreferrer"
                className="nav-link"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--color-text-tertiary)",
                  textDecoration: "none",
                  transition: "color 0.15s ease",
                }}
              >
                github
              </a>
            </div>
          )}

          {/* Mobile hamburger */}
          {isMobile && (
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={open}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--color-text-tertiary)",
                padding: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
        </div>

        {/* Mobile drawer */}
        {open && isMobile && (
          <div
            style={{
              background: "var(--color-bg-primary)",
              borderTop: "1px solid var(--color-border-primary)",
              padding: "1.25rem 1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            {navLinks.map((link, i) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  color: "var(--color-text-tertiary)",
                  textDecoration: "none",
                  padding: "0.625rem 0",
                  borderBottom: i < navLinks.length - 1
                    ? "1px solid var(--color-border-primary)"
                    : undefined,
                  display: "block",
                }}
              >
                {link.label.toLowerCase()}
              </a>
            ))}
            <div
              style={{
                display: "flex",
                gap: "1.25rem",
                alignItems: "center",
                paddingTop: "1rem",
              }}
            >
              <a
                href="https://github.com/AdityaChauhanX07/txfence"
                target="_blank"
                rel="noopener noreferrer"
                className="nav-link"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--color-text-tertiary)",
                  textDecoration: "none",
                  transition: "color 0.15s ease",
                }}
              >
                github
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Mobile backdrop — outside header so it doesn't inherit stacking context */}
      {open && isMobile && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            top: 52,
            background: "rgba(0,0,0,0.4)",
            zIndex: 49,
          }}
        />
      )}
    </>
  );
}
