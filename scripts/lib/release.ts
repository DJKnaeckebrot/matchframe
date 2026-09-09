export function artifactNames(version: string): {
  setup: string
  portable: string
  checksums: string
} {
  return {
    setup: `Matchframe-Setup-${version}-win-x64.exe`,
    portable: `Matchframe-Portable-${version}-win-x64.zip`,
    checksums: "SHA256SUMS.txt",
  }
}

export function sha256sumLine(hash: string, filename: string): string {
  return `${hash}  ${filename}`
}

export function formatSha256Sums(entries: ReadonlyArray<{ hash: string; filename: string }>): string {
  return `${entries.map((entry) => sha256sumLine(entry.hash, entry.filename)).join("\n")}\n`
}

export const PORTABLE_FILENAMES = [
  "Matchframe.exe",
  "README.txt",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "portable.flag",
] as const

export function isForbiddenReleasePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/")
  const parts = normalized.split("/")
  if (parts.includes("node_modules") || parts.includes(".git")) {
    return true
  }
  if (parts.some((part) => part === ".env" || part.startsWith(".env."))) {
    return true
  }
  if (normalized.includes("gsi-capture")) {
    return true
  }
  if (normalized.includes("apps/server/data")) {
    return true
  }
  return false
}

export function isccMissingMessage(): string {
  return [
    "Inno Setup (ISCC.exe) was not found.",
    "Install Inno Setup 6 from https://jrsoftware.org/isdl.php",
    "or set ISCC to the full path of ISCC.exe.",
    "See packaging/windows/README.md.",
  ].join("\n")
}
