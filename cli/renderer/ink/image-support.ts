export type ImageProtocol = "kitty" | "iterm2" | "none";

export function detectTerminalImageProtocol(): ImageProtocol {
  const term = process.env.TERM ?? "";
  const prog = process.env.TERM_PROGRAM ?? "";

  if (term === "xterm-kitty" || process.env.KITTY_WINDOW_ID) return "kitty";
  if (prog === "iTerm.app" || prog === "WezTerm" || prog === "rio") return "iterm2";
  return "none";
}

export function supportsInlineImages(protocol: ImageProtocol): boolean {
  return protocol !== "none";
}
