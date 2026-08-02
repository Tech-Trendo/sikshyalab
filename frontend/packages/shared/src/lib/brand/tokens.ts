/**
 * ShikshaLab brand & design tokens — colors match official logo.
 */
export const brand = {
  name: "ShikshaLab",
  colors: {
    primary: "#1B3A6B",
    primaryLight: "#2D5A94",
    highlight: "#F5A623",
    success: "#22c55e",
    destructive: "#ef4444",
  },
  logo: {
    path: "/shikshalab-logo.png",
    alt: "शिक्षा LAB — ShikshaLab",
    roundedSize: "h-10 w-auto",
  },
  typography: {
    sans: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    display: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
  },
  radius: {
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
  },
  spacing: {
    pageX: "1.25rem",
    sectionY: "5rem",
    sectionYMd: "7rem",
    containerMax: "72rem",
  },
} as const;

export type BrandColor = keyof typeof brand.colors;
