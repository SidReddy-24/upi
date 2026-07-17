// FraudShield AI — Premium Dark Theme Color System
export const Colors = {
  // Background hierarchy
  bg: {
    app:       "#080B12",   // deepest app bg
    surface:   "#0D1117",   // card surfaces
    elevated:  "#131B28",   // raised panels
    border:    "#1E2D45",   // subtle borders
    overlay:   "#1A2540",   // modal overlays
  },
  
  // Brand accent
  accent: {
    primary:   "#4F8FFF",   // electric blue — brand primary
    glow:      "#4F8FFF30", // transparent glow
    secondary: "#7C5CFC",   // violet secondary
    teal:      "#00D4AA",   // teal for success
  },
  
  // Semantic risk colors
  risk: {
    approve:   "#22C55E",   // vibrant green
    approveBg: "#22C55E18",
    review:    "#F59E0B",   // amber
    reviewBg:  "#F59E0B18",
    reject:    "#EF4444",   // vivid red
    rejectBg:  "#EF444418",
    critical:  "#FF2D55",   // critical red/pink
    criticalBg:"#FF2D5518",
  },

  // Text
  text: {
    primary:   "#F0F4FF",   // near-white
    secondary: "#8B9DBF",   // muted blue-grey
    tertiary:  "#4A5A7A",   // very muted
    inverse:   "#080B12",
  },

  // Severity
  severity: {
    critical: "#FF2D55",
    high:     "#EF4444",
    medium:   "#F59E0B",
    low:      "#22C55E",
  },
  
  // Status
  status: {
    up:      "#22C55E",
    down:    "#EF4444",
    degraded:"#F59E0B",
  },

  // Chart palette
  chart: [
    "#4F8FFF", "#7C5CFC", "#00D4AA", "#F59E0B", "#EF4444", "#EC4899",
  ],
};

export type RiskDecision = "APPROVE" | "REVIEW" | "REJECT";

export const decisionColor = (d: RiskDecision) => {
  if (d === "APPROVE") return Colors.risk.approve;
  if (d === "REVIEW")  return Colors.risk.review;
  return Colors.risk.reject;
};

export const decisionBg = (d: RiskDecision) => {
  if (d === "APPROVE") return Colors.risk.approveBg;
  if (d === "REVIEW")  return Colors.risk.reviewBg;
  return Colors.risk.rejectBg;
};

export const riskColor = (score: number) => {
  if (score < 0.35) return Colors.risk.approve;
  if (score < 0.75) return Colors.risk.review;
  return Colors.risk.reject;
};
