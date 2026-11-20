import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        porcelain: {
          bg: "#FAF9F7",
          card: "#FFFFFF",
          subtle: "#F3F2EE",
          border: "#E5E2DC",
          ink: "#0F172A",
          muted: "#64748B",
        },
        sumi: {
          bg: "#111113",
          card: "#18181B",
          subtle: "#222226",
          border: "#27272A",
          ink: "#F4F4F5",
        },
        vermilion: {
          DEFAULT: "#E04F33",
          hover: "#C83E23",
        },
      },
      fontFamily: {
        sans: ["var(--font-ui)", "system-ui", "sans-serif"],
        jp: ["var(--font-noto-sans-jp)", "Hiragino Kaku Gothic ProN", "Meiryo", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
