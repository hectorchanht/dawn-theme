// @dawn-studio/theme — any-theme support for Dawn Studio apps.
//
// Convention: `<html data-theme="...">` drives CSS variables; the choice
// persists in localStorage; the browser chrome (`theme-color` meta) follows.
// Any theme names work ("dark", "light", "sepia", "oled"…); dark is the default.
//
// Wiring:
//   1. In `<head>`, inline `themeInitScript()` — reads localStorage and sets
//      the theme attribute BEFORE first paint (no wrong-theme flash).
//   2. In your app shell, `readTheme()` on mount and `applyTheme(t)` on toggle.

/** Any theme name ("dark", "light", "sepia", "oled"…). */
export type Theme = string;

/** Convenience constants for the classic pair. */
export const DARK: Theme = "dark";
export const LIGHT: Theme = "light";

/** Default allowed theme list. */
export const DEFAULT_THEMES: Theme[] = [DARK, LIGHT];

/** Fallback when nothing is stored / SSR. */
export const DEFAULT_THEME: Theme = DARK;

/** System-preference matching queries. */
export interface SystemThemeQueries {
	/** @default "(prefers-color-scheme: dark)" */
	darkQuery?: string;
	/** @default "(prefers-color-scheme: light)" */
	lightQuery?: string;
}

export interface ThemeOptions {
	/** localStorage key. @default "dawn-theme" */
	storageKey?: string;
	/** Theme attribute on <html>. @default "data-theme" */
	attribute?: string;
	/** Allowed theme names (cycle order for nextTheme). @default ["dark", "light"] */
	themes?: string[];
	/** Fallback theme. @default "dark" (or themes[0] when custom) */
	defaultTheme?: string;
	/**
	 * Follow the OS preference when nothing is stored: system dark → the
	 * "dark" entry if present, else themes[0]; system light → the "light"
	 * entry if present, else themes[1] ?? themes[0]. `true` uses the default
	 * prefers-color-scheme queries; pass an object for custom queries.
	 * @default false
	 */
	followSystem?: boolean | SystemThemeQueries;
	/** Browser chrome color per theme (theme-color meta). @default { dark: "#000000", light: "#ffffff" } */
	colors?: Record<string, string>;
	/**
	 * Favicon swap per theme. @default null (don't touch the favicon).
	 * Example: { dark: "/favicon.png", light: "/favicon-light.png" }
	 */
	favicon?: Record<string, string> | null;
	/**
	 * CSS color-scheme per theme. @default inferred from the name
	 * (contains "dark"/"oled"/"night"/"black" → "dark", else "light").
	 * Example: { sepia: "light", oled: "dark" }
	 */
	colorSchemes?: Record<string, string>;
	/** Called by applyTheme after the theme is applied. */
	onChange?: (theme: Theme) => void;
}

interface ResolvedOptions {
	storageKey: string;
	attribute: string;
	themes: string[];
	defaultTheme: string;
	followSystem: boolean | SystemThemeQueries;
	colors: Record<string, string>;
	favicon: Record<string, string> | null;
	colorSchemes: Record<string, string>;
	onChange?: (theme: Theme) => void;
}

function resolveOpts(o: ThemeOptions = {}): ResolvedOptions {
	const themes = o.themes && o.themes.length > 0 ? o.themes : DEFAULT_THEMES;
	return {
		storageKey: o.storageKey ?? "dawn-theme",
		attribute: o.attribute ?? "data-theme",
		themes,
		defaultTheme:
			o.defaultTheme && themes.includes(o.defaultTheme)
				? o.defaultTheme
				: (themes[0] ?? DEFAULT_THEME),
		followSystem: o.followSystem ?? false,
		colors: o.colors ?? { dark: "#000000", light: "#ffffff" },
		favicon: o.favicon ?? null,
		colorSchemes: o.colorSchemes ?? {},
		onChange: o.onChange,
	};
}

/**
 * Parse a stored value against an allowlist; anything unrecognized →
 * fallback (default: first allowed theme, or "dark").
 */
export function parseTheme(
	v: string | null | undefined,
	allowed: string[] = DEFAULT_THEMES,
	fallback?: string,
): Theme {
	const list = allowed.length > 0 ? allowed : DEFAULT_THEMES;
	const fb = fallback ?? list[0] ?? DEFAULT_THEME;
	return v != null && list.includes(v) ? v : fb;
}

/**
 * Cycle to the next theme in the allowed list (wraps around).
 * Keeps the classic dark ↔ light flip for the default pair.
 */
export function nextTheme(
	t: Theme,
	themesOrOpts: string[] | { themes?: string[] } = DEFAULT_THEMES,
): Theme {
	const given = Array.isArray(themesOrOpts)
		? themesOrOpts
		: (themesOrOpts.themes ?? DEFAULT_THEMES);
	const list = given.length > 0 ? given : DEFAULT_THEMES;
	return list[(list.indexOf(t) + 1) % list.length]!;
}

/** CSS color-scheme for a theme: explicit map → name heuristic. */
function colorSchemeFor(t: string, c: ResolvedOptions): string {
	const mapped = c.colorSchemes[t];
	if (mapped) return mapped;
	return /dark|oled|night|black/i.test(t) ? "dark" : "light";
}

/**
 * Resolve the OS-preferred theme (null when followSystem is off or
 * matchMedia is unavailable). Mapping: system dark → the "dark" entry if
 * present, else themes[0]; system light → the "light" entry if present,
 * else themes[1] ?? themes[0].
 */
function systemTheme(c: ResolvedOptions): Theme | null {
	if (!c.followSystem) return null;
	if (typeof window === "undefined" || typeof window.matchMedia !== "function")
		return null;
	const q: SystemThemeQueries =
		typeof c.followSystem === "object" ? c.followSystem : {};
	const darkQuery = q.darkQuery ?? "(prefers-color-scheme: dark)";
	const lightQuery = q.lightQuery ?? "(prefers-color-scheme: light)";
	try {
		if (window.matchMedia(darkQuery).matches)
			return c.themes.includes(DARK) ? DARK : (c.themes[0] ?? DEFAULT_THEME);
		if (window.matchMedia(lightQuery).matches)
			return c.themes.includes(LIGHT)
				? LIGHT
				: (c.themes[1] ?? c.themes[0] ?? DEFAULT_THEME);
	} catch {
		return null;
	}
	return null;
}

/**
 * Resolve the theme to use on first load: stored value → OS preference
 * (when followSystem) → defaultTheme. Never throws; SSR → defaultTheme.
 */
export function resolveInitialTheme(o: ThemeOptions = {}): Theme {
	const c = resolveOpts(o);
	try {
		const stored = window.localStorage.getItem(c.storageKey);
		if (stored && c.themes.includes(stored)) return stored;
		const sys = systemTheme(c);
		if (sys) return sys;
	} catch {
		/* restricted storage / SSR: fall through to default */
	}
	return c.defaultTheme;
}

/** Read the current theme from the DOM (source of truth); SSR → defaultTheme. */
export function readTheme(o: ThemeOptions = {}): Theme {
	const c = resolveOpts(o);
	if (typeof document === "undefined") return c.defaultTheme;
	return parseTheme(
		document.documentElement.getAttribute(c.attribute),
		c.themes,
		c.defaultTheme,
	);
}

/**
 * Apply + persist a theme: sets the theme attribute, `color-scheme`, the
 * theme-color meta, optionally swaps the favicon, writes localStorage, then
 * calls onChange. Never throws.
 */
export function applyTheme(t: Theme, o: ThemeOptions = {}): void {
	const c = resolveOpts(o);
	try {
		const root = document.documentElement;
		root.setAttribute(c.attribute, t);
		root.style.colorScheme = colorSchemeFor(t, c);
		const col = c.colors[t] ?? c.colors[c.defaultTheme];
		if (col) {
			document
				.querySelector('meta[name="theme-color"]')
				?.setAttribute("content", col);
		}
		const fav = c.favicon?.[t];
		if (fav) {
			document.querySelector('link[rel="icon"]')?.setAttribute("href", fav);
		}
		window.localStorage.setItem(c.storageKey, t);
		try {
			c.onChange?.(t);
		} catch {
			/* user callback must not break theming */
		}
	} catch {
		/* SSR or restricted storage: theme just won't persist */
	}
}

/**
 * Inline `<head>` script (run before first paint): reads localStorage →
 * sets the theme attribute + color-scheme + theme-color (+ favicon)
 * synchronously, so the page never flashes the wrong theme. Embed verbatim:
 *
 *   <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
 *
 * Accepts the same options (themes, defaultTheme, followSystem via
 * matchMedia, custom attribute).
 */
export function themeInitScript(o: ThemeOptions = {}): string {
	const c = resolveOpts(o);
	const key = JSON.stringify(c.storageKey);
	const attr = JSON.stringify(c.attribute);
	const themes = JSON.stringify(c.themes);
	const fallback = JSON.stringify(c.defaultTheme);
	const mapDark = JSON.stringify(
		c.themes.includes(DARK) ? DARK : (c.themes[0] ?? DEFAULT_THEME),
	);
	const mapLight = JSON.stringify(
		c.themes.includes(LIGHT)
			? LIGHT
			: (c.themes[1] ?? c.themes[0] ?? DEFAULT_THEME),
	);
	const cs: Record<string, string> = {};
	for (const t of c.themes) cs[t] = colorSchemeFor(t, c);
	const colorSchemes = JSON.stringify(cs);
	const colors = JSON.stringify(c.colors);
	const favicons = JSON.stringify(c.favicon ?? {});
	const q: SystemThemeQueries =
		typeof c.followSystem === "object" ? c.followSystem : {};
	const darkQuery = JSON.stringify(q.darkQuery ?? "(prefers-color-scheme: dark)");
	const lightQuery = JSON.stringify(
		q.lightQuery ?? "(prefers-color-scheme: light)",
	);
	const systemPick = c.followSystem
		? `var mm=window.matchMedia;` +
			`t=(mm&&mm(${darkQuery}).matches)?${mapDark}:` +
			`(mm&&mm(${lightQuery}).matches)?${mapLight}:${fallback};`
		: `t=${fallback};`;
	return (
		`try{var t=localStorage.getItem(${key});` +
		`if(${themes}.indexOf(t)<0){` +
		systemPick +
		`}` +
		`var r=document.documentElement;r.setAttribute(${attr},t);` +
		`r.style.colorScheme=(${colorSchemes}[t]||"light");` +
		`var m=document.querySelector('meta[name="theme-color"]');` +
		`if(m){var col=(${colors}[t]||${colors}[${fallback}]);if(col)m.setAttribute("content",col);}` +
		`var fav=(${favicons}[t]);` +
		`if(fav){var l=document.querySelector('link[rel="icon"]');if(l)l.href=fav;}` +
		`}catch(e){}`
	);
}
