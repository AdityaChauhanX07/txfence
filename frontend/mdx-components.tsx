import { useMDXComponents as getThemeComponents } from "nextra-theme-docs";

export function useMDXComponents(
  components?: Record<string, React.ComponentType>
) {
  return {
    ...getThemeComponents(),
    ...components,
  };
}
