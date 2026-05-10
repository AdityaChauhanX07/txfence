import { cn } from "@/lib/utils";

interface SectionProps {
  headline: string;
  subheadline?: string;
  align?: "left" | "center";
  children?: React.ReactNode;
  className?: string;
  id?: string;
}

export function Section({
  headline,
  subheadline,
  align = "center",
  children,
  className,
  id,
}: SectionProps) {
  const centered = align === "center";

  return (
    <section id={id} className={cn("py-20 lg:py-28", className)}>
      <div className={cn("mb-12", centered && "text-center")}>
        <h2
          className={cn(
            "text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4"
          )}
        >
          {headline}
        </h2>
        {subheadline && (
          <p
            className={cn(
              "text-lg text-text-secondary max-w-2xl",
              centered && "mx-auto"
            )}
          >
            {subheadline}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
