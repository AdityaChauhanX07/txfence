import { Nav } from "@/components/homepage/nav";

const releases = [
  {
    version: "v0.19.0",
    date: "2026-05-01",
    title: "Developer Experience Improvements",
    summary:
      "Added pnpm dev script at the repo root — starts Anvil (if Foundry is installed) and vitest in watch mode for @txfence/core. Color-prefixed output per process: green for Anvil, purple for tests. SIGINT and SIGTERM handled cleanly.",
    tag: "Release",
    tagVariant: "info" as const,
    highlights: [
      "pnpm dev starts Anvil + vitest watch mode",
      "Automatic Foundry detection with clear install instructions",
      "Clean SIGINT/SIGTERM handling for all child processes",
      "tsx added as root devDependency",
    ],
  },
  {
    version: "v0.18.0",
    date: "2026-04-28",
    title: "Treasury Agent Example & Security Documentation",
    summary:
      "Complete end-to-end treasury agent example using all 12 packages. Security model documentation, runbook, and Changesets integration for monorepo version management.",
    tag: "Release",
    tagVariant: "info" as const,
    highlights: [
      "examples/treasury-agent/ — realistic DAO treasury policy",
      "5 pipeline examples in dry-run mode",
      "docs/security-model.md — threat model and webhook verification",
      "docs/runbook.md — troubleshooting for every PolicyRejectionReason",
      "@changesets/cli integration for release management",
    ],
  },
  {
    version: "v0.17.0",
    date: "2026-04-25",
    title: "Property-Based Tests for Policy Engine",
    summary:
      "8 property tests, 1800 random iterations using fast-check v4. Deterministic evaluation, chain validation, and spend cap enforcement formally verified.",
    tag: "Release",
    tagVariant: "info" as const,
    highlights: [
      "Evaluation is always deterministic — same inputs, same outputs",
      "Transfer at exactly maxSpendPerTx always passes",
      "Transfer over maxSpendPerTx always fails with spend_exceeds_cap",
      "evaluate() never throws for any valid action/policy combination",
    ],
  },
  {
    version: "v0.16.0",
    date: "2026-04-22",
    title: "Contract Test Suites & Atomic Checkpoint Writes",
    summary:
      "Shared test suites for ReceiptStore, CapLockProvider, AuditLog, and ApprovalProvider interfaces. Write-then-rename pattern for atomic checkpoint persistence.",
    tag: "Release",
    tagVariant: "info" as const,
    highlights: [
      "receiptStoreContract — 7 shared tests any ReceiptStore must pass",
      "capLockProviderContract — 5 shared tests for cap locking",
      "auditLogContract — 6 tests for audit log backends",
      "Write-then-rename atomic checkpoint writes",
    ],
  },
  {
    version: "v0.15.0",
    date: "2026-04-20",
    title: "Bigint Serialization & Architecture Decisions",
    summary:
      "Centralized bigint serialization utilities shared across all storage backends. 12 Architecture Decision Records documenting the key design choices behind txfence.",
    tag: "Release",
    tagVariant: "info" as const,
    highlights: [
      "Shared bigintReplacer/bigintReviver for all storage backends",
      "12 ADRs covering cancel-on-timeout, cap locking, simulation strategy",
      "ADR format: status, context, decision, consequences",
    ],
  },
];

export default function BlogPage() {
  return (
    <>
      <style>{`
        .blog-link:hover { color: var(--color-text-secondary); }
        .blog-entry:not(:last-child) { border-bottom: 1px solid var(--color-border-primary); padding-bottom: 2.5rem; margin-bottom: 0; }
      `}</style>
      <Nav />
      <main style={{ minHeight: "100vh", padding: "7rem 1.5rem 4rem", background: "var(--color-bg-primary)" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>
          <div style={{ marginBottom: "3rem" }}>
            <h1 style={{ fontFamily: "sans-serif", fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "0.375rem" }}>
              Changelog
            </h1>
            <p style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--color-text-tertiary)" }}>
              Release notes and updates from the txfence project.
            </p>
          </div>

          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "1px", background: "var(--color-border-primary)" }} />

            <div>
              {releases.map((release) => (
                <div
                  key={release.version}
                  className="blog-entry"
                  style={{ position: "relative", paddingLeft: "1.75rem" }}
                >
                  <div style={{ position: "absolute", left: "-4px", top: "6px", width: "9px", height: "9px", borderRadius: "50%", background: "var(--color-bg-primary)", border: "1px solid var(--color-border-secondary)" }} />

                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "0.5rem" }}>
                    <span style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--color-text-secondary)" }}>{release.version}</span>
                    <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--color-text-tertiary)" }}>{release.date}</span>
                  </div>

                  <p style={{ fontFamily: "sans-serif", fontSize: "1rem", fontWeight: 500, color: "var(--color-text-primary)", marginBottom: "0.5rem", lineHeight: 1.4, margin: "0 0 0.5rem 0" }}>
                    {release.title}
                  </p>

                  <p style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--color-text-tertiary)", lineHeight: 1.7, marginBottom: "0.875rem", margin: "0 0 0.875rem 0" }}>
                    {release.summary}
                  </p>

                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 0.875rem 0" }}>
                    {release.highlights.map((h, i) => (
                      <li key={i} style={{ display: "flex", gap: "0.5rem", fontFamily: "monospace", fontSize: "11px", color: "var(--color-text-tertiary)", lineHeight: 1.7 }}>
                        <span style={{ color: "var(--color-success)", flexShrink: 0 }}>✓</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>

                  <a
                    href="https://github.com/AdityaChauhanX07/txfence/releases"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="blog-link"
                    style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--color-text-tertiary)", textDecoration: "none" }}
                  >
                    View on GitHub →
                  </a>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "3rem", paddingTop: "1.5rem", borderTop: "1px solid var(--color-border-primary)" }}>
            <p style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--color-text-tertiary)", marginBottom: "0.375rem" }}>
              Full history in the repository
            </p>
            <a
              href="https://github.com/AdityaChauhanX07/txfence/blob/main/CHANGELOG.md"
              target="_blank"
              rel="noopener noreferrer"
              className="blog-link"
              style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--color-text-tertiary)", textDecoration: "none" }}
            >
              View full CHANGELOG.md →
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
