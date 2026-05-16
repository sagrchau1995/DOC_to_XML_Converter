import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./layouts/**/*.{ts,tsx}", "./forms/**/*.{ts,tsx}", "./tables/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#182129",
        muted: "#66727f",
        line: "#d9e1e8",
        surface: "#ffffff",
        canvas: "#f2f5f6",
        teal: "#0f766e",
        navy: "#17313b",
        danger: "#b42318",
        success: "#14804a",
        amber: "#a15c07"
      }
    }
  },
  plugins: []
};

export default config;
