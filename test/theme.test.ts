import { describe, it, expect, vi, afterEach } from "vitest";
import {
	applyTheme,
	nextTheme,
	parseTheme,
	readTheme,
	resolveInitialTheme,
	themeInitScript,
	DEFAULT_THEME,
	DEFAULT_THEMES,
	DARK,
	LIGHT,
	type Theme,
} from "../src/index.js";

afterEach(() => {
	vi.unstubAllGlobals();
});

// --- minimal DOM stub --------------------------------------------------------

function stubDom(datasetTheme?: string, matchMediaMatches?: Record<string, boolean>) {
	const attrs = new Map<string, string>();
	const meta = { setAttribute: (k: string, v: string) => attrs.set(`meta:${k}`, v) };
	const link = { setAttribute: (k: string, v: string) => attrs.set(`link:${k}`, v) };
	const store = new Map<string, string>();
	const docEl = {
		dataset: { theme: datasetTheme },
		style: {} as Record<string, string>,
		getAttribute: (k: string) => (k === "data-theme" ? (datasetTheme ?? null) : null),
		setAttribute: (k: string, v: string) => {
			attrs.set(`attr:${k}`, v);
			if (k === "data-theme") docEl.dataset.theme = v;
		},
	};
	vi.stubGlobal("document", {
		documentElement: docEl,
		querySelector: (sel: string) => (sel.includes("meta") ? meta : sel.includes("link") ? link : null),
	});
	vi.stubGlobal("window", {
		localStorage: {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => void store.set(k, v),
		},
		matchMedia: (q: string) => ({ matches: matchMediaMatches?.[q] ?? false }),
	});
	return { attrs, store, docEl };
}

describe("constants", () => {
	it("classic dark/light constants", () => {
		expect(DARK).toBe("dark");
		expect(LIGHT).toBe("light");
		expect(DEFAULT_THEME).toBe("dark");
		expect(DEFAULT_THEMES).toEqual(["dark", "light"]);
	});
});

describe("parseTheme / nextTheme", () => {
	it("parses stored values, defaults to dark", () => {
		expect(parseTheme("dark")).toBe("dark");
		expect(parseTheme("light")).toBe("light");
		expect(parseTheme(null)).toBe("dark");
		expect(parseTheme("sepia")).toBe("dark");
	});

	it("validates against an allowlist", () => {
		expect(parseTheme("sepia", ["sepia", "dark"])).toBe("sepia");
		expect(parseTheme("nope", ["sepia", "dark"])).toBe("sepia"); // → themes[0]
		expect(parseTheme(null, ["a", "b"])).toBe("a");
		expect(parseTheme("x", ["a", "b"], "b")).toBe("b"); // explicit fallback
	});

	it("flips the theme", () => {
		expect(nextTheme("dark")).toBe("light");
		expect(nextTheme("light")).toBe("dark");
	});

	it("cycles through an arbitrary list and wraps", () => {
		const themes = ["sepia", "oled", "light"];
		expect(nextTheme("sepia", themes)).toBe("oled");
		expect(nextTheme("oled", themes)).toBe("light");
		expect(nextTheme("light", themes)).toBe("sepia");
		expect(nextTheme("unknown", themes)).toBe("sepia");
		expect(nextTheme("sepia", { themes })).toBe("oled");
	});
});

describe("readTheme", () => {
	it("reads data-theme from the DOM", () => {
		stubDom("light");
		expect(readTheme()).toBe("light");
	});

	it("SSR (no document) → default", () => {
		expect(readTheme()).toBe("dark");
	});

	it("supports custom attribute and allowlist", () => {
		stubDom("sepia");
		expect(readTheme({ attribute: "data-theme", themes: ["sepia", "dark"] })).toBe("sepia");
		expect(readTheme({ themes: ["sepia"] })).toBe("sepia");
		stubDom("bogus");
		expect(readTheme({ themes: ["sepia", "dark"] })).toBe("sepia"); // → themes[0]
	});
});

describe("applyTheme", () => {
	it("sets data-theme, color-scheme, theme-color meta and persists", () => {
		const { attrs, store, docEl } = stubDom("dark");
		applyTheme("light");
		expect(attrs.get("attr:data-theme")).toBe("light");
		expect(docEl.dataset.theme).toBe("light");
		expect(docEl.style.colorScheme).toBe("light");
		expect(attrs.get("meta:content")).toBe("#ffffff");
		expect(store.get("dawn-theme")).toBe("light");
	});

	it("uses custom storage key and colors, swaps favicon when configured", () => {
		const { attrs, store } = stubDom();
		applyTheme("dark", {
			storageKey: "my-app-theme",
			colors: { dark: "#111111", light: "#fafafa" },
			favicon: { dark: "/d.png", light: "/l.png" },
		});
		expect(attrs.get("meta:content")).toBe("#111111");
		expect(attrs.get("link:href")).toBe("/d.png");
		expect(store.get("my-app-theme")).toBe("dark");
	});

	it("leaves the favicon alone by default", () => {
		const { attrs } = stubDom();
		applyTheme("dark");
		expect(attrs.has("link:href")).toBe(false);
	});

	it("applies arbitrary themes with custom attribute, color-scheme inference and onChange", () => {
		const { attrs, store, docEl } = stubDom();
		const seen: string[] = [];
		applyTheme("oled", {
			attribute: "data-bs-theme",
			themes: ["sepia", "oled"],
			colors: { sepia: "#f4ecd8", oled: "#000000" },
			onChange: (t) => seen.push(t),
		});
		expect(attrs.get("attr:data-bs-theme")).toBe("oled");
		expect(docEl.style.colorScheme).toBe("dark"); // heuristic: oled → dark
		expect(attrs.get("meta:content")).toBe("#000000");
		expect(store.get("dawn-theme")).toBe("oled");
		expect(seen).toEqual(["oled"]);
	});
});

describe("resolveInitialTheme", () => {
	it("stored value wins", () => {
		const { store } = stubDom(undefined, { "(prefers-color-scheme: dark)": true });
		store.set("dawn-theme", "light");
		expect(resolveInitialTheme({ followSystem: true })).toBe("light");
	});

	it("falls back to OS preference when nothing stored", () => {
		stubDom(undefined, { "(prefers-color-scheme: dark)": true });
		expect(resolveInitialTheme({ followSystem: true })).toBe("dark");
		stubDom(undefined, { "(prefers-color-scheme: light)": true });
		expect(resolveInitialTheme({ followSystem: true })).toBe("light");
	});

	it("maps system dark/light into a custom theme list", () => {
		stubDom(undefined, { "(prefers-color-scheme: dark)": true });
		expect(resolveInitialTheme({ themes: ["sepia", "oled"], followSystem: true })).toBe("sepia");
		stubDom(undefined, { "(prefers-color-scheme: light)": true });
		expect(resolveInitialTheme({ themes: ["sepia", "oled"], followSystem: true })).toBe("oled");
		stubDom(undefined, { "(prefers-color-scheme: dark)": true });
		expect(
			resolveInitialTheme({
				themes: ["sepia", "dark", "light"],
				followSystem: { darkQuery: "(prefers-color-scheme: dark)" },
			}),
		).toBe("dark");
	});

	it("SSR / nothing stored → defaultTheme", () => {
		expect(resolveInitialTheme()).toBe("dark");
		expect(resolveInitialTheme({ defaultTheme: "sepia", themes: ["sepia"] })).toBe("sepia");
	});
});

describe("themeInitScript", () => {
	it("embeds the storage key and is dark-default", () => {
		const s = themeInitScript();
		expect(s).toContain('"dawn-theme"');
		expect(s).toContain('"data-theme"');
		expect(s.startsWith("try{")).toBe(true);
		expect(s.endsWith("}catch(e){}")).toBe(true);
	});

	it("honors custom key/colors/favicon", () => {
		const s = themeInitScript({
			storageKey: "k",
			colors: { dark: "#111", light: "#fff" },
			favicon: { dark: "/d.png", light: "/l.png" },
		});
		expect(s).toContain('"k"');
		expect(s).toContain("#111");
		expect(s).toContain("/l.png");
	});

	it("supports custom attribute, theme list and followSystem via matchMedia", () => {
		const s = themeInitScript({
			attribute: "data-bs-theme",
			themes: ["sepia", "oled"],
			defaultTheme: "sepia",
			followSystem: true,
		});
		expect(s).toContain('"data-bs-theme"');
		expect(s).toContain('["sepia","oled"]');
		expect(s).toContain("matchMedia");
		expect(s).toContain("(prefers-color-scheme: dark)");
		expect(s).toContain('"sepia"'); // fallback
	});

	it("is a single self-contained statement (safe to inline)", () => {
		const s = themeInitScript();
		expect(s.startsWith("try{")).toBe(true);
		expect(s.endsWith("}catch(e){}")).toBe(true);
	});
});

// type-level sanity: Theme is now any string
const _t: Theme = "sepia";
void _t;
