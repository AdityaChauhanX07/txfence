import { importPage } from "nextra/pages";
import { useMDXComponents } from "../../../mdx-components";

// Explicitly enumerate all doc pages (Nextra v4 content-dir catch-all pattern)
export function generateStaticParams() {
  return [
    { slug: [] },
    { slug: ["getting-started"] },
    { slug: ["core-concepts"] },
    { slug: ["architecture"] },
    { slug: ["failure-taxonomy"] },
    { slug: ["security-model"] },
    { slug: ["runbook"] },

    // API reference
    { slug: ["api-reference"] },
    { slug: ["api-reference", "core"] },
    { slug: ["api-reference", "evm"] },
    { slug: ["api-reference", "solana"] },
    { slug: ["api-reference", "cosmos"] },
    { slug: ["api-reference", "redis"] },
    { slug: ["api-reference", "storage-pg"] },
    { slug: ["api-reference", "storage-sqlite"] },
    { slug: ["api-reference", "audit"] },
    { slug: ["api-reference", "monitor"] },
    { slug: ["api-reference", "verify"] },
    { slug: ["api-reference", "provenance"] },
    { slug: ["api-reference", "mcp"] },
    { slug: ["api-reference", "cli"] },
    { slug: ["api-reference", "react"] },

    // Guides
    { slug: ["guides"] },
    { slug: ["guides", "dry-run"] },
    { slug: ["guides", "composite-policies"] },
    { slug: ["guides", "chain-agnostic-policy"] },
    { slug: ["guides", "policy-versioning"] },
    { slug: ["guides", "policy-diff"] },
    { slug: ["guides", "config-validation"] },
    { slug: ["guides", "audit-log"] },
    { slug: ["guides", "provenance-chains"] },
    { slug: ["guides", "telemetry"] },
    { slug: ["guides", "notifications"] },
    { slug: ["guides", "formal-verification"] },
    { slug: ["guides", "stress-testing"] },
    { slug: ["guides", "mev-protection"] },
    { slug: ["guides", "circuit-breaker"] },
    { slug: ["guides", "intent-execution"] },
    { slug: ["guides", "multi-agent"] },
    { slug: ["guides", "temporal-rules"] },
    { slug: ["guides", "replay"] },
    { slug: ["guides", "agent-health"] },
    { slug: ["guides", "fork-simulation"] },
  ];
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  try {
    const { metadata } = await importPage(["docs", ...(params.slug ?? [])]);
    return metadata;
  } catch {
    return {};
  }
}

const Wrapper = useMDXComponents().wrapper;

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const result = await importPage(["docs", ...(params.slug ?? [])]);
  const { default: MDXContent, toc, metadata, sourceCode } = result;
  return (
    <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
      <MDXContent params={params} />
    </Wrapper>
  );
}
