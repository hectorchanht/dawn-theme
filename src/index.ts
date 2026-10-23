// @dawn-studio/theme — dark/light theme for Dawn Studio apps.
//
// Convention: `<html data-theme="dark|light">` drives CSS variables; the choice
// persists in localStorage; the browser chrome (`theme-color` meta) follows.
// Dark is the default.
//
// Wiring:
//   1. In `<head>`, inline `themeInitScript()` — reads localStorage and sets
//      data-theme BEFORE first paint (no wrong-theme flash).
//   2. In your app shell, `readTheme()` on mount and `applyTheme(t)` on toggle.

/** Supported themes. Dark is the default. */
export type Theme = "dark" | "light";

/** Fallback when nothing is stored / SSR. */
export const DEFAULT_THEME: Theme = "dark";

export interface ThemeOptions {
	/** localStorage key. @default "dawn-theme" */
	storageKey?: string;
	/** Browser chrome color per theme (theme-color meta). @default { dark: "#000000", light: "#ffffff" } */
	colors?: { dark: string; light: string };
	/**
	 * Favicon swap per theme. @default null (don't touch the favicon).
	 * Example: { dark: "/favicon.png", light: "/favicon-light.png" }
	 */
	favicon?: { dark: string; light: string } | null;
}

const DEFAULTS: Required<Omit<ThemeOptions, "favicon">> & { favicon: ThemeOptions["favicon"] } = {
	storageKey: "dawn-theme",
	colors: { dark: "#000000", light: "#ffffff" },
	favicon: null,
};

function opts(o: ThemeOptions = {}): typeof DEFAULTS {
	return {
		storageKey: o.storageKey ?? DEFAULTS.storageKey,
		colors: o.colors ?? DEFAULTS.colors,
		favicon: o.favicon ?? DEFAULTS.favicon,
	};
}

/** Parse a stored value; anything unrecognized → default (dark). */
export function parseTheme(v: string | null | undefined): Theme {
	return v === "light" || v === "dark" ? v : DEFAULT_THEME;
}

/** Flip dark ↔ light. */
export function nextTheme(t: Theme): Theme {
	return t === "dark" ? "light" : "dark";
}

/** Read the current theme from the DOM (source of truth); SSR → default. */
export function readTheme(o: ThemeOptions = {}): Theme {
	if (typeof document === "undefined") return DEFAULT_THEME;
	return parseTheme(document.documentElement.dataset.theme);
}

/**
 * Apply + persist a theme: sets `data-theme`, `color-scheme`, the theme-color
 * meta, optionally swaps the favicon, and writes localStorage. Never throws.
 */
export function applyTheme(t: Theme, o: ThemeOptions = {}): void {
	const c = opts(o);
	try {
		const root = document.documentElement;
		root.dataset.theme = t;
		root.style.colorScheme = t;
		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute("content", c.colors[t]);
		if (c.favicon) {
			document
				.querySelector('link[rel="icon"]')
				?.setAttribute("href", c.favicon[t]);
		}
		window.localStorage.setItem(c.storageKey, t);
	} catch {
		/* SSR or restricted storage: theme just won't persist */
	}
}

/**
 * Inline `<head>` script (run before first paint): reads localStorage → sets
 * data-theme + color-scheme + theme-color (+ favicon) synchronously, so the
 * page never flashes the wrong theme. Embed verbatim:
 *
 *   <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
 */
export function themeInitScript(o: ThemeOptions = {}): string {
	const c = opts(o);
	const key = JSON.stringify(c.storageKey);
	const darkColor = JSON.stringify(c.colors.dark);
	const lightColor = JSON.stringify(c.colors.light);
	const faviconSwap = c.favicon
		? `var l=document.querySelector('link[rel="icon"]');if(l)l.href=t==="light"?${JSON.stringify(c.favicon.light)}:${JSON.stringify(c.favicon.dark)};`
		: "";
	return (
		`try{var t=localStorage.getItem(${key});` +
		`t=t==="light"?"light":"dark";` +
		`var r=document.documentElement;r.dataset.theme=t;r.style.colorScheme=t;` +
		`var col=t==="light"?${lightColor}:${darkColor};` +
		`var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",col);` +
		faviconSwap +
		`}catch(e){}`
	);
}
