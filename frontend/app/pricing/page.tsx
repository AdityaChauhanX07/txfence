import { Nav } from "@/components/homepage/nav";
import { Footer } from "@/components/homepage/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const openSourceFeatures = [
  "MIT License — use it anywhere",
  "Full access to all 15 packages",
  "Self-hosted on your infrastructure",
  "Community support via GitHub Issues",
  "600+ tests, zero type errors",
  "EVM, Solana, and Cosmos adapters",
  "MCP server for AI assistant integration",
  "Complete audit log and monitor packages",
];

const enterpriseFeatures = [
  "Managed cloud infrastructure",
  "SLAs and priority support",
  "Dedicated RPC endpoints",
  "Custom chain adapters",
  "Compliance certification",
  "Private audit log storage",
  "Enterprise onboarding",
  "Direct engineering access",
];

export default function PricingPage() {
  return (
    <>
      <Nav />
      <main style={{ minHeight: "100vh", padding: "6rem 1.5rem 4rem" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>

          {/* Header */}
          <div data-animate style={{ marginBottom: "3rem", "--stagger": 1 } as React.CSSProperties}>
            <p style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--color-text-tertiary)",
              marginBottom: "0.75rem",
              letterSpacing: "0.05em",
            }}>
              pricing
            </p>
            <h1 style={{
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(1.5rem, 3vw, 2rem)",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              marginBottom: "0.75rem",
              lineHeight: 1.3,
            }}>
              Open source. Production ready.
            </h1>
            <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              txfence is MIT licensed. Self-host on your own infrastructure with zero vendor lock-in.
            </p>
          </div>

          {/* Plans */}
          <div data-animate style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", "--stagger": 2 } as React.CSSProperties}>

            {/* Open Source */}
            <Card>
              <div style={{ padding: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
                      open source
                    </span>
                    <Badge variant="success">Current</Badge>
                  </div>
                  <div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)" }}>
                      free
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-tertiary)", marginLeft: "0.375rem" }}>
                      forever
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: "1.25rem" }}>
                  Everything you need to build policy-gated agents.
                </p>

                <div style={{ marginBottom: "1.5rem" }}>
                  {openSourceFeatures.map((feature) => (
                    <div key={feature} style={{ display: "flex", alignItems: "baseline", gap: "0.625rem", marginBottom: "0.5rem" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-success)", flexShrink: 0 }}>✓</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-secondary)" }}>{feature}</span>
                    </div>
                  ))}
                </div>

                <Button variant="secondary" size="md" href="/docs" className="w-full justify-center">
                  Get Started
                </Button>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "center", marginTop: "0.625rem" }}>
                  No account required · No usage limits
                </p>
              </div>
            </Card>

            {/* Enterprise */}
            <Card className="opacity-80">
              <div style={{ padding: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
                      enterprise
                    </span>
                    <Badge variant="default">Coming Soon</Badge>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)" }}>
                    contact us
                  </span>
                </div>

                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: "1.25rem" }}>
                  Managed infrastructure with SLAs for institutional teams.
                </p>

                <div style={{ marginBottom: "1.5rem" }}>
                  {enterpriseFeatures.map((feature) => (
                    <div key={feature} style={{ display: "flex", alignItems: "baseline", gap: "0.625rem", marginBottom: "0.5rem" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-tertiary)", flexShrink: 0 }}>○</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-tertiary)" }}>{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="md"
                  href="mailto:quantitativefinance6@gmail.com?subject=txfence Enterprise"
                  className="w-full justify-center"
                >
                  Contact Us
                </Button>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "center", marginTop: "0.625rem" }}>
                  Early access available
                </p>
              </div>
            </Card>
          </div>

          {/* Bottom */}
          <div data-animate style={{
            marginTop: "3rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid var(--color-border-primary)",
            "--stagger": 3,
          } as React.CSSProperties}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-tertiary)", marginBottom: "0.5rem" }}>
              questions?
            </p>
            <a
              href="https://github.com/AdityaChauhanX07/txfence/discussions"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-secondary)" }}
            >
              open a discussion on github →
            </a>
          </div>

        </div>
      </main>
      <Footer />
    </>
  );
}
