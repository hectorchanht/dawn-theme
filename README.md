# @dawn-studio/theme

Any-theme support for Dawn Studio apps. Vanilla, zero dependencies. Extracted from Numerology.

- **Any theme names** — `"dark"`, `"light"`, `"sepia"`, `"oled"`, anything. Zero-config defaults keep working: dark default, `data-theme` attribute.
- **Everything configurable** — theme list, default, custom attribute, storage key, per-theme browser-chrome colors, favicon swaps, `color-scheme` mapping, change callback.
- **Follow the OS** — `followSystem` resolves `prefers-color-scheme` when nothing is stored, in both the JS API and the inline head script.
- **SSR-safe, never throws** — every browser access is guarded.

## Install

```bash
npm i @dawn-studio/theme
```

## Wiring

**1. Inline the init script in `<head>`** — reads localStorage and sets the theme attribute *before first paint*, so the page never flashes the wrong theme:

```tsx
<script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
```

**2. Read on mount, apply on toggle:**

```ts
import { readTheme, applyTheme, nextTheme, type Theme } from "@dawn-studio/theme";

const [theme, setTheme] = useState<Theme>(() => readTheme());
const toggle = () => {
  const t = nextTheme(theme);
  applyTheme(t);
  setTheme(t);
};
```

**3. Drive your CSS from the theme attribute:**

```css
:root, [data-theme="dark"] { --bg: #000; --fg: #fff; }
[data-theme="light"] { --bg: #fff; --fg: #000; }
```

## Follow the OS preference

```ts
const opts = { followSystem: true };

// first load: stored choice → OS dark/light → "dark"
const initial = resolveInitialTheme(opts);

// same behavior before first paint — put this in <head>
themeInitScript(opts);
```

Custom themes with system mapping (system dark → the `"dark"` entry if present, else `themes[0]`; system light → the `"light"` entry if present, else `themes[1] ?? themes[0]`):

```tsx
const opts = {
  themes: ["sepia", "oled", "light"],
  defaultTheme: "sepia",
  followSystem: true, // or { darkQuery: "(prefers-color-scheme: dark)" }
  colors: { sepia: "#f4ecd8", oled: "#000000", light: "#ffffff" },
  onChange: (t) => console.log("theme →", t),
};

<script dangerouslySetInnerHTML={{ __html: themeInitScript(opts) }} />
<ThemeToggle onClick={() => { const t = nextTheme(theme, opts); applyTheme(t, opts); setTheme(t); }} />
```

## Options

```ts
applyTheme("oled", {
  storageKey: "my-app-theme",      // default "dawn-theme"
  attribute: "data-bs-theme",      // default "data-theme"
  themes: ["sepia", "oled"],       // default ["dark", "light"]
  defaultTheme: "sepia",           // default "dark" (or themes[0])
  followSystem: true,              // default false
  colors: { sepia: "#f4ecd8", oled: "#000000" },  // theme-color meta per theme
  favicon: { sepia: "/f-sepia.png", oled: "/f-oled.png" }, // default: don't touch
  colorSchemes: { oled: "dark" },  // CSS color-scheme per theme; default inferred from the name
  onChange: (t) => track("theme", t),
});
themeInitScript({ storageKey: "my-app-theme", followSystem: true }); // same options
readTheme({ attribute: "data-bs-theme", themes: ["sepia", "oled"] });
```

## API

| Export | Description |
|---|---|
| `themeInitScript(opts?)` | Inline `<head>` script: localStorage → theme attribute + `color-scheme` + `theme-color` (+ favicon), synchronously before paint. Honors `themes`, `defaultTheme`, `followSystem` (via `matchMedia`), `attribute`, `colors`, `favicon`, `colorSchemes`. |
| `readTheme(opts?)` | Current theme from the DOM (source of truth); SSR-safe → `defaultTheme`. |
| `resolveInitialTheme(opts?)` | First-load resolution: stored → OS preference (`followSystem`) → `defaultTheme`. Never throws; SSR-safe. |
| `applyTheme(t, opts?)` | Sets the attribute, `color-scheme`, `theme-color` meta, optional favicon swap, persists to localStorage, then calls `onChange`. Never throws. |
| `parseTheme(v, allowed?, fallback?)` | Validates against an allowlist; garbage → `fallback` (default: `allowed[0]`, else `"dark"`). |
| `nextTheme(t, themesOrOpts?)` | Cycles through the theme list (wraps); dark ↔ light for the default pair. |
| `DEFAULT_THEME` | `"dark"` |
| `DEFAULT_THEMES` | `["dark", "light"]` |
| `DARK`, `LIGHT` | `"dark"`, `"light"` |
