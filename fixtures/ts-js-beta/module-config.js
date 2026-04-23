export const DEFAULT_THEME = {
  accent: "violet",
  density: "compact",
};

export function mergeThemeConfig(baseConfig, overrides = {}) {
  return {
    ...baseConfig,
    ...overrides,
  };
}
