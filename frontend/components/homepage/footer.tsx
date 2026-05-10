// ─── Data ─────────────────────────────────────────────────────────────────────

const FOOTER_COLS = [
  {
    heading: "Product",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "Playground", href: "/playground" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    heading: "Resources",
    links: [
      {
        label: "GitHub",
        href: "https://github.com/AdityaChauhanX07/txfence",
        external: true,
      },
      { label: "Security Model", href: "/docs/security-model" },
      { label: "Runbook", href: "/docs/runbook" },
      {
        label: "Contributing",
        href: "https://github.com/AdityaChauhanX07/txfence/blob/main/CONTRIBUTING.md",
        external: true,
      },
    ],
  },
  {
    heading: "Packages",
    links: [
      {
        label: "@txfence/core",
        href: "https://www.npmjs.com/package/@txfence/core",
        external: true,
        mono: true,
      },
      {
        label: "@txfence/evm",
        href: "https://www.npmjs.com/package/@txfence/evm",
        external: true,
        mono: true,
      },
      {
        label: "@txfence/solana",
        href: "https://www.npmjs.com/package/@txfence/solana",
        external: true,
        mono: true,
      },
      {
        label: "@txfence/cosmos",
        href: "https://www.npmjs.com/package/@txfence/cosmos",
        external: true,
        mono: true,
      },
    ],
  },
  {
    heading: "Built by",
    links: [
      {
        label: "Aditya Chauhan",
        href: "https://github.com/AdityaChauhanX07",
        external: true,
      },
      {
        label: "MIT License",
        href: "https://github.com/AdityaChauhanX07/txfence/blob/main/LICENSE",
        external: true,
      },
      {
        label: "GitHub Repository",
        href: "https://github.com/AdityaChauhanX07/txfence",
        external: true,
      },
    ],
  },
] as Array<{
  heading: string;
  links: Array<{ label: string; href: string; external?: boolean; mono?: boolean }>;
}>;

// ─── Footer ───────────────────────────────────────────────────────────────────

export function Footer() {
  return (
    <footer
      style={{
        padding: "4rem 1.5rem 3rem",
        borderTop: "1px solid var(--color-border-primary)",
      }}
    >
      <style>{".footer-link:hover { color: var(--color-text-secondary); }"}</style>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Link groups */}
        {FOOTER_COLS.map((col) => (
          <div
            key={col.heading}
            style={{
              display: "flex",
              gap: "1rem",
              marginBottom: "0.75rem",
              alignItems: "baseline",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--color-text-tertiary)",
                minWidth: 96,
                flexShrink: 0,
              }}
            >
              {col.heading.toLowerCase()}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
              {col.links.map((link, i) => (
                <span key={link.label}>
                  <a
                    href={link.href}
                    className="footer-link"
                    {...(link.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    style={{
                      color: "var(--color-text-tertiary)",
                      textDecoration: "none",
                      transition: "color 0.15s ease",
                    }}
                  >
                    {link.label.toLowerCase()}
                  </a>
                  {i < col.links.length - 1 && (
                    <span style={{ color: "var(--color-border-secondary)", margin: "0 0.375rem" }}>
                      ·
                    </span>
                  )}
                </span>
              ))}
            </span>
          </div>
        ))}

        {/* Bottom bar */}
        <div
          style={{
            marginTop: "3rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid var(--color-border-primary)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--color-text-tertiary)",
            }}
          >
            © 2026 txfence. MIT License.
          </span>

          <a
            href="/"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--color-text-secondary)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <svg width="18" height="12" viewBox="0 0 28 18" fill="none" aria-hidden="true" style={{ color: "var(--color-text-secondary)" }}>
              <rect x="5" y="1" width="2" height="16" rx="1" fill="currentColor"/>
              <rect x="1" y="1" width="10" height="2" rx="1" fill="currentColor"/>
              <rect x="18" y="1" width="2" height="16" rx="1" fill="currentColor"/>
              <rect x="18" y="1" width="8" height="2" rx="1" fill="currentColor"/>
              <rect x="14" y="9" width="12" height="2" rx="1" fill="currentColor"/>
            </svg>
            txfence
          </a>
        </div>
      </div>
    </footer>
  );
}
