import { importPage } from "nextra/pages";
import { useMDXComponents } from "../../../mdx-components";

// Explicitly enumerate all doc pages (Nextra v4 content-dir catch-all pattern)
export function generateStaticParams() {
  return [
    { slug: [] },
    { slug: ["getting-started"] },
    { slug: ["core-concepts"] },
    { slug: ["api-reference"] },
    { slug: ["api-reference", "core"] },
    { slug: ["api-reference", "evm"] },
    { slug: ["api-reference", "solana"] },
    { slug: ["api-reference", "cosmos"] },
    { slug: ["api-reference", "mcp"] },
    { slug: ["api-reference", "cli"] },
    { slug: ["api-reference", "react"] },
    { slug: ["architecture"] },
    { slug: ["failure-taxonomy"] },
    { slug: ["security-model"] },
    { slug: ["runbook"] },
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
