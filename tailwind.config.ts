import type { Config } from "tailwindcss";

/**
 * Eco-Data Link production core.
 *
 * Two visual registers share one palette:
 *  - Console (`/admin`, `/hotel-portal`) drives colour through the `--bt-*`
 *    tokens declared in `globals.css`, so surfaces stay theme-agnostic.
 *  - Guest & lobby (`/client`, `/lobby`) use the named ramps below, inherited
 *    from the public demo repo so both products read as one brand.
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canopy: {
          950: "#050d0a",
          900: "#081511",
          800: "#0c1f18",
          700: "#123026",
          lift: "#10261d",
        },
        sand: {
          100: "#f5f0e8",
          200: "#e8dfd0",
          300: "#d4c9b8",
        },
        moss: {
          500: "#3d9b7a",
          400: "#52b892",
          300: "#6fd4ad",
        },
        teal: {
          600: "#1a6b5c",
          500: "#248f7a",
          400: "#3ab89e",
        },
        gold: {
          600: "#9a7b56",
          500: "#b8956a",
          400: "#c4a574",
        },
        clay: {
          500: "#bd6c46",
          400: "#d08256",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      animation: {
        "pulse-soft": "pulseSoft 4s ease-in-out infinite",
        "ping-ring": "pingRing 3.2s ease-out infinite",
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "ken-burns": "kenBurns 28s ease-in-out infinite alternate",
        shake: "shake 0.36s cubic-bezier(0.36, 0.07, 0.19, 0.97)",
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "0.7", transform: "scale(1.05)" },
        },
        pingRing: {
          "0%": { transform: "scale(0.6)", opacity: "0.7" },
          "80%, 100%": { transform: "scale(2.2)", opacity: "0" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        kenBurns: {
          "0%": { transform: "scale(1) translate3d(0, 0, 0)" },
          "100%": { transform: "scale(1.08) translate3d(-1.5%, -1%, 0)" },
        },
        // Rejected-PIN feedback. Small amplitude: a wrong code is a mistake,
        // not an alarm.
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%, 60%": { transform: "translateX(-5px)" },
          "40%, 80%": { transform: "translateX(5px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
