import rootPackage from "../../../package.json" with { type: "json" }

export const PRODUCT_NAME = "Matchframe"
export const PRODUCT_DESCRIPTION = "Matchframe Broadcast Overlay"
export const PRODUCT_PUBLISHER = "Matchframe"
export const PRODUCT_COPYRIGHT = "Copyright © 2026 Matchframe contributors"
export const PORTABLE_FLAG_NAME = "portable.flag"

export const PRODUCT_VERSION: string = rootPackage.version

export function windowsFileVersion(version = PRODUCT_VERSION): string {
  const [core, pre] = version.split("-")
  const parts = (core ?? "0.0.0").split(".").map((part) => Number.parseInt(part, 10))
  const major = Number.isFinite(parts[0]) ? parts[0]! : 0
  const minor = Number.isFinite(parts[1]) ? parts[1]! : 0
  const patch = Number.isFinite(parts[2]) ? parts[2]! : 0
  let build = 0
  if (pre) {
    const digits = Number.parseInt(pre.replace(/\D+/g, ""), 10)
    if (Number.isFinite(digits)) {
      build = digits
    }
  }
  return `${major}.${minor}.${patch}.${build}`
}
