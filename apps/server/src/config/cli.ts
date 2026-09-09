export type CliOptions = {
  portable: boolean
  openBrowser: boolean
  setupGsi: boolean
  help: boolean
}

export function parseCli(argv: readonly string[]): CliOptions {
  const flags = new Set(argv.filter((arg) => arg.startsWith("-")))
  return {
    portable: flags.has("--portable"),
    openBrowser: !flags.has("--no-browser"),
    setupGsi: flags.has("--setup-gsi"),
    help: flags.has("--help") || flags.has("-h"),
  }
}

export function cliHelp(version: string): string {
  return [
    `Matchframe ${version}`,
    "",
    "  --portable     Store data next to Matchframe.exe (./data)",
    "  --no-browser   Do not open the dashboard after startup",
    "  --setup-gsi    Install or update the CS2 GSI config, then start",
    "  --help         Show this help",
  ].join("\n")
}
