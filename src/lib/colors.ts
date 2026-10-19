// Folder / list icon palette (iOS system colours, as in Setgraph).
export const COLORS = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "gray"] as const;
export type Color = (typeof COLORS)[number];

export const COLOR_HEX: Record<Color, string> = {
  red: "#ff453a",
  orange: "#ff9f0a",
  yellow: "#ffd60a",
  green: "#30d158",
  teal: "#64d2ff",
  blue: "#0a84ff",
  purple: "#bf5af2",
  pink: "#ff375f",
  gray: "#8e8e93",
};

export const hexFor = (c: string | null | undefined) => COLOR_HEX[(c as Color) ?? "gray"] ?? COLOR_HEX.gray;
