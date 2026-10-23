import { describe, it, expect, vi, afterEach } from "vitest";
import {
	applyTheme,
	nextTheme,
	parseTheme,
	readTheme,
	themeInitScript,
	DEFAULT_THEME,
	type Theme,
} from "../src/index.js";

afterEach(() => {
	vi.unstubAllGlobals();
});

// --- minimal DOM stub --------------------------------------------------------

function stubDom(datasetTheme?: string) {
	const attrs = new Map<string, string>();
	const meta = { setAttribute: (k: string, v: string) => attrs.set(`meta:${k}`, v) };
	const link = { setAttribute: (k: string, v: string) => attrs.set(`link:${k}`, v) };
	const store = new Map<string, string>();
	const docEl = { dataset: { theme: datasetTheme }, style: {} as Record<string, string> };
	vi.stubGlobal("document", {
		documentElement: docEl,
		querySelector: (sel: string) => (sel.includes("meta") ? meta : sel.includes("link") ? link : null),
	});
	vi.stubGlobal("window", {
		localStorage: {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => void store.set(k, v),
		},
	});
	return { attrs, store, docEl };
}

describe("parseTheme / nextTheme", () => {
	it("parses stored values, defaults to dark", () => {
		expect(parseTheme("dark")).toBe("dark");
		expect(parseTheme("light")).toBe("light");
		expect(parseTheme(null)).toBe("dark");
		expect(parseTheme("sepia")).toBe("dark");
		expect(DEFAULT_THEME).toBe("dark");
	});

	it("flips the theme", () => {
		expect(nextTheme("dark")).toBe("light");
		expect(nextTheme("light")).toBe("dark");
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
});

describe("applyTheme", () => {
	it("sets data-theme, color-scheme, theme-color meta and persists", () => {
		const { attrs, store, docEl } = stubDom("dark");
		applyTheme("light");
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
});

describe("themeInitScript", () => {
	it("embeds the storage key and is dark-default", () => {
		const s = themeInitScript();
		expect(s).toContain('"dawn-theme"');
		expect(s).toContain('t==="light"?"light":"dark"');
		expect(s).toContain("dataset.theme=t");
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

	it("is a single self-contained statement (safe to inline)", () => {
		const s = themeInitScript();
		expect(s.startsWith("try{")).toBe(true);
		expect(s.endsWith("}catch(e){}")).toBe(true);
	});
});

// type-level sanity: Theme is exactly "dark" | "light"
const _t: Theme = "dark";
void _t;
