import type { Severity } from "./engine";

export const colors = {
  bg: "#F4F7F5",
  surface: "#FFFFFF",
  ink: "#0B1411",
  inkSoft: "#56635D",
  inkFaint: "#8A958F",
  line: "#E2E8E4",
  accent: "#1B7F5E",
  accentSoft: "#E5F2EC",
  danger: "#A21B12",
  warnBg: "#FBEEE9",
};

/**
 * Severity → colour + label. Note: "Unknown" is documented-but-uncharacterized and is NOT safe,
 * so it gets its own cautionary colour, deliberately distinct from "Minor" and never green.
 */
export const severityStyle: Record<
  Severity,
  { bg: string; fg: string; label: string; caution: string }
> = {
  Major: { bg: "#FBE3DF", fg: "#A21B12", label: "Major", caution: "Higher-risk documented interaction." },
  Moderate: { bg: "#FCEFD8", fg: "#8A5200", label: "Moderate", caution: "Moderate documented interaction." },
  Minor: { bg: "#E7EBEE", fg: "#46525C", label: "Minor", caution: "Lower-risk documented interaction." },
  Unknown: { bg: "#E7E2F1", fg: "#4E3E83", label: "Unknown", caution: "Documented but uncharacterized — not a safe signal." },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };

export const font = {
  h1: 30,
  h2: 22,
  h3: 18,
  body: 16,
  small: 13,
  tiny: 11,
};
