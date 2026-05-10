import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const openSourceFeatures = [
  "MIT License — use it anywhere",
  "Full access to all 15 packages",
  "Self-hosted on your infrastructure",
  "Community support via GitHub Issues",
  "252 tests, zero type errors",
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
    <main className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            Open source. Production ready.
          </h1>
          <p className="text-text-secondary text-lg max-w-xl mx-auto">
            txfence is MIT licensed. Self-host on your own infrastructure with zero vendor lock-in.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Open Source */}
          <Card className="p-8 border-accent/40 hover:-translate-y-0">
            <div className="flex items-center gap-3 mb-6">
              <Badge variant="success">Current</Badge>
              <span className="text-xs text-text-tertiary">Available now</span>
            </div>

            <h2 className="text-2xl font-bold text-text-primary mb-2">Open Source</h2>
            <p className="text-text-secondary text-sm mb-6">
              Everything you need to build policy-gated agents.
            </p>

            <div className="mb-8">
              <span className="text-4xl font-extrabold text-accent">Free</span>
              <span className="text-text-tertiary text-sm ml-2">forever</span>
            </div>

            <ul className="space-y-3 mb-8">
              {openSourceFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-text-secondary">
                  <span className="text-success flex-shrink-0 mt-0.5">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Button variant="primary" size="lg" href="/docs" className="w-full justify-center">
              Get Started
            </Button>

            <p className="text-xs text-text-tertiary text-center mt-3">
              No account required · No usage limits
            </p>
          </Card>

          {/* Enterprise */}
          <Card className="p-8 border-dashed opacity-80 hover:-translate-y-0">
            <div className="flex items-center gap-3 mb-6">
              <Badge variant="default">Coming Soon</Badge>
              <span className="text-xs text-text-tertiary">2026</span>
            </div>

            <h2 className="text-2xl font-bold text-text-primary mb-2">Enterprise</h2>
            <p className="text-text-secondary text-sm mb-6">
              Managed infrastructure with SLAs for institutional teams.
            </p>

            <div className="mb-8">
              <span className="text-2xl font-bold text-text-secondary">Contact us</span>
            </div>

            <ul className="space-y-3 mb-8">
              {enterpriseFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-text-tertiary">
                  <span className="text-text-tertiary flex-shrink-0 mt-0.5">○</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              variant="outline"
              size="lg"
              href="mailto:quantitativefinance6@gmail.com?subject=txfence Enterprise"
              className="w-full justify-center"
            >
              Contact Us
            </Button>

            <p className="text-xs text-text-tertiary text-center mt-3">
              Early access available
            </p>
          </Card>
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-text-tertiary mb-2">
            Questions? Open an issue or start a discussion on GitHub.
          </p>
          <a
            href="https://github.com/AdityaChauhanX07/txfence/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:underline"
          >
            GitHub Discussions →
          </a>
        </div>
      </div>
    </main>
  );
}
