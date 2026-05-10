import type { ReactNode } from "react";
import { getPageMap } from "nextra/page-map";
import { Layout, Navbar, Footer } from "nextra-theme-docs";
import "nextra-theme-docs/style.css";
import "./docs-theme.css";

const logo = (
  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--color-text-primary)" }}>
    <svg
      width="22"
      height="14"
      viewBox="0 0 28 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="5" y="1" width="2" height="16" rx="1" fill="currentColor"/>
      <rect x="1" y="1" width="10" height="2" rx="1" fill="currentColor"/>
      <rect x="18" y="1" width="2" height="16" rx="1" fill="currentColor"/>
      <rect x="18" y="1" width="8" height="2" rx="1" fill="currentColor"/>
      <rect x="14" y="9" width="12" height="2" rx="1" fill="currentColor"/>
    </svg>
    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "15px", fontWeight: 500, color: "var(--color-text-primary)" }}>
      txfence
    </span>
  </div>
);

export default async function DocsLayout({ children }: { children: ReactNode }) {
  const pageMap = await getPageMap("/docs");

  return (
    <Layout
      pageMap={pageMap}
      docsRepositoryBase="https://github.com/AdityaChauhanX07/txfence/tree/main/frontend"
      navigation
      darkMode={false}
      nextThemes={{ defaultTheme: "dark", storageKey: "txfence-theme", forcedTheme: "dark" }}
      sidebar={{ defaultMenuCollapseLevel: 1 }}
      navbar={
        <Navbar
          logo={logo}
          projectLink="https://github.com/AdityaChauhanX07/txfence"
        />
      }
      footer={
        <Footer>
          <span style={{ color: "#686885", fontSize: "14px" }}>
            MIT License · Built by Aditya Chauhan · © 2026 txfence
          </span>
        </Footer>
      }
    >
      <div data-animate style={{ "--start": "100ms" } as React.CSSProperties}>
        {children}
      </div>
    </Layout>
  );
}
