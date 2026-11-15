import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        washi: {
          bg: "#FAFAFA",
          card: "#FFFFFF",
          border: "#E2E8F0",
          ink: "#1E293B",
          muted: "#64748B",
        },
        sumi: {
          DEFAULT: "#0F766E",
          hover: "#115E59",
          soft: "#F0FDFA",
        },
        ochre: {
          DEFAULT: "#D97706",
          soft: "#FFFBEB",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        jp: ["var(--font-noto-sans-jp)", "Hiragino Kaku Gothic ProN", "Meiryo", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
