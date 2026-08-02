/**
 * ShikshaLab brand tokens — single source of truth (logo palette).
 */
export const brand = {
  name: "ShikshaLab",
  colors: {
    orange: "#F5A623",
    orangeAlt: "#F7B84D",
    navy: "#1F3F66",
    navyDark: "#16304F",
    body: "#5A6B7D",
    shade: "#FBF7F0",
    border: "#E8E2D8",
    lighten01: "#FFF6E8",
    lighten02: "#EAF0F6",
  },
  backgroundImage: {
    gradient: "linear-gradient(-90deg, #F7B84D 0%, #F5A623 100%)",
  },
  boxShadow: {
    soft: "0px 10px 50px rgba(31,63,102,0.1)",
    med: "0px 10px 30px rgba(31,63,102,0.15)",
    glow: "0px 20px 70px rgba(245,166,35,0.2)",
  },
  borderRadius: {
    sm: "5px",
    DEFAULT: "10px",
    lg: "16px",
  },
  transitionDuration: {
    brand: "300ms",
  },
  typography: {
    primary: '"Poppins", ui-sans-serif, system-ui, sans-serif',
    secondary: '"Poppins", ui-sans-serif, system-ui, sans-serif',
  },
  logo: {
    path: "/shikshalab-brand.png",
    alt: "शिक्षा LAB — ShikshaLab",
    roundedSize: "h-10 w-auto",
  },
} as const;

export type BrandColor = keyof typeof brand.colors;
