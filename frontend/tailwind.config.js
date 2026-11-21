export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--canvas)",
        card: "var(--surface)",
        border: "var(--line)",
        primary: { DEFAULT: "var(--accent)", hover: "#1d4ed8" },
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
