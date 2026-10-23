# @dawn-studio/theme

Dark/light theme for Dawn Studio apps. Vanilla, zero dependencies. Extracted from Numerology.

## Install

```bash
npm i @dawn-studio/theme
```

## Wiring

**1. Inline the init script in `<head>`** — reads localStorage and sets `data-theme` *before first paint*, so the page never flashes the wrong theme:

```tsx
<script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
```

**2. Read on mount, apply on toggle:**

```ts
import { readTheme, applyTheme, nextTheme } from "@dawn-studio/theme";

const [theme, setTheme] = useState<Theme>(() => readTheme());
const toggle = () => {
  const t = nextTheme(theme);
  applyTheme(t);
  setTheme(t);
};
```

**3. Drive your CSS from `data-theme`:**

```css
:root, [data-theme="dark"] { --bg: #000; --fg: #fff; }
[data-theme="light"] { --bg: #fff; --fg: #000; }
```

## Options

```ts
applyTheme("light", {
  storageKey: "my-app-theme",                    // default "dawn-theme"
  colors: { dark: "#000000", light: "#ffffff" },  // theme-color meta
  favicon: { dark: "/favicon.png", light: "/favicon-light.png" }, // default: don't touch
});
themeInitScript({ storageKey: "my-app-theme", colors, favicon }); // same options
readTheme({ storageKey: "my-app-theme" });
```

## API

| Export | Description |
|---|---|
| `themeInitScript(opts?)` | Inline `<head>` script: localStorage → `data-theme` + `color-scheme` + `theme-color` (+ favicon), synchronously before paint. |
| `readTheme(opts?)` | Current theme from the DOM (source of truth); SSR-safe → `"dark"`. |
| `applyTheme(t, opts?)` | Sets `data-theme`, `color-scheme`, `theme-color` meta, optional favicon swap, persists to localStorage. Never throws. |
| `parseTheme(v)` | `"dark"` / `"light"` or default; garbage → `"dark"`. |
| `nextTheme(t)` | Flips dark ↔ light. |
| `DEFAULT_THEME` | `"dark"` |

## License

Apache-2.0
