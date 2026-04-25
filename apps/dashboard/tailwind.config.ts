import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:       "#0a0a0a",
        surface:  "#141414",
        border:   "#1f1f1f",
        muted:    "#71717a",
        text:     "#e4e4e7",
        accent:   "#1D9E75", // green
        warn:     "#BA7517", // amber
        danger:   "#A32D2D"  // red
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["ui-monospace", "Menlo", "Consolas", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
