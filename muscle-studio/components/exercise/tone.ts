/**
 * The exercise components live in two places with different surfaces: the
 * white contextual card of the atlas ("light") and the dark dashboard pages
 * ("dark"). Same structure, colours from the existing design tokens of each.
 */
export type Tone = "light" | "dark";

export const TONES: Record<Tone, Record<string, string>> = {
  light: {
    text: "text-[#13213d]",
    muted: "text-[#6b7891]",
    soft: "text-[#4b5d80]",
    title: "text-[#0B2E6B]",
    border: "border-[#e3e8f2]",
    card: "bg-white border-[#e3e8f2]",
    cardOpen: "bg-[#fbfcfe] border-[#E8602C]/60",
    chip: "bg-[#eef2f8] text-[#4b5d80]",
    input: "border-[#cfd6e4] bg-white text-[#13213d] placeholder:text-[#9aa5b8] focus:border-[#173F8A]",
    tabs: "bg-[#eef2f8]",
    tabOn: "bg-white font-semibold text-[#0B2E6B] shadow-sm",
    tabOff: "text-[#4b5d80]",
    pillOn: "border-[#0B2E6B] bg-[#0B2E6B] text-white",
    pillOff: "border-[#cfd6e4] text-[#0B2E6B] hover:bg-[#f2f5fa]",
    ghost: "text-[#4b5d80] hover:bg-[#eef2f8]",
    link: "text-[#173F8A] hover:underline",
    step: "bg-[#eef2f8] text-[#0B2E6B]",
    note: "bg-[#f5f7fb] text-[#4b5d80]",
  },
  dark: {
    text: "text-fg",
    muted: "text-muted",
    soft: "text-muted",
    title: "text-fg",
    border: "border-line",
    card: "bg-panel border-line",
    cardOpen: "bg-panel-2 border-accent/60",
    chip: "bg-panel-3 text-muted",
    input: "border-line-strong bg-panel-2 text-fg placeholder:text-muted focus:border-accent",
    tabs: "bg-panel-2",
    tabOn: "bg-panel-3 font-semibold text-fg",
    tabOff: "text-muted",
    pillOn: "border-accent bg-accent text-white",
    pillOff: "border-line-strong text-fg hover:bg-panel-2",
    ghost: "text-muted hover:bg-panel-2",
    link: "text-accent-2 hover:underline",
    step: "bg-panel-3 text-fg",
    note: "bg-panel-2 text-muted",
  },
};
