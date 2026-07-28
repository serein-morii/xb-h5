export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_CACHE_KEY = "xb-h5-theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const saved = window.localStorage.getItem(THEME_CACHE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }
  return "system";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  return typeof window !== "undefined" && window.matchMedia?.(DARK_QUERY).matches ? "dark" : "light";
}

export function applyThemePreference(preference: ThemePreference = readThemePreference()): ResolvedTheme {
  const resolved = resolveTheme(preference);
  if (typeof document === "undefined") return resolved;

  const root = document.documentElement;
  root.classList.toggle("theme-dark", resolved === "dark");
  root.classList.toggle("theme-light", resolved === "light");
  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;
  root.style.colorScheme = resolved;
  return resolved;
}

export function setThemePreference(preference: ThemePreference): ResolvedTheme {
  try {
    window.localStorage.setItem(THEME_CACHE_KEY, preference);
  } catch {
    // Applying the choice still works even when persistence is unavailable.
  }
  return applyThemePreference(preference);
}

let stopSystemListener: (() => void) | null = null;

export function initializeTheme(): () => void {
  stopSystemListener?.();
  applyThemePreference();

  if (typeof window === "undefined" || !window.matchMedia) return () => {};

  const query = window.matchMedia(DARK_QUERY);
  const handleChange = () => {
    if (readThemePreference() === "system") applyThemePreference("system");
  };

  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", handleChange);
    stopSystemListener = () => query.removeEventListener("change", handleChange);
  } else {
    query.addListener(handleChange);
    stopSystemListener = () => query.removeListener(handleChange);
  }

  return () => {
    stopSystemListener?.();
    stopSystemListener = null;
  };
}
