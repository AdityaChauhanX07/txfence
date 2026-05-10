import { Nav } from "@/components/homepage/nav";
import { Hero } from "@/components/homepage/hero";
import { Problem } from "@/components/homepage/problem";
import { Pipeline } from "@/components/homepage/pipeline";
import { FailureGrid } from "@/components/homepage/failure-grid";
import { ChainSupport } from "@/components/homepage/chain-support";
import { PackageGrid } from "@/components/homepage/package-grid";
import { QuickStart } from "@/components/homepage/quick-start";
import { CTA } from "@/components/homepage/cta";
import { Footer } from "@/components/homepage/footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Pipeline />
        <FailureGrid />
        <ChainSupport />
        <PackageGrid />
        <QuickStart />
        <CTA />
      </main>
      <Footer />
    </>
  );
}