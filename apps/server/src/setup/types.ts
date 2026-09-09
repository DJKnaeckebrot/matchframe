export const GSI_CFG_FILENAME = "gamestate_integration_matchframe.cfg"

export type SetupPlatform = "windows" | "linux" | "unsupported"

export type GsiInstallStatus =
  | {
      state: "installed"
      path: string
      needsUpdate: false
    }
  | {
      state: "outdated"
      path: string
      needsUpdate: true
    }
  | {
      state: "not-installed"
      targetPath: string
    }
  | {
      state: "cs2-not-found"
    }
  | {
      state: "unsupported"
      reason: string
    }

export type SetupStatus = {
  platform: SetupPlatform
  gsiUri: string
  canOpenFolder: boolean
  cs2: {
    found: boolean
    cfgDirectory?: string
    gsi: GsiInstallStatus
  }
}

export function parseSetupStatus(value: unknown): SetupStatus | null {
  if (!isRecord(value) || !isPlatform(value.platform) || typeof value.gsiUri !== "string") {
    return null
  }
  if (typeof value.canOpenFolder !== "boolean" || !isRecord(value.cs2) || typeof value.cs2.found !== "boolean") {
    return null
  }
  const gsi = parseGsiInstallStatus(value.cs2.gsi)
  if (!gsi) {
    return null
  }
  return {
    platform: value.platform,
    gsiUri: value.gsiUri,
    canOpenFolder: value.canOpenFolder,
    cs2: {
      found: value.cs2.found,
      ...(typeof value.cs2.cfgDirectory === "string" ? { cfgDirectory: value.cs2.cfgDirectory } : {}),
      gsi,
    },
  }
}

function parseGsiInstallStatus(value: unknown): GsiInstallStatus | null {
  if (!isRecord(value) || typeof value.state !== "string") {
    return null
  }
  if (value.state === "installed") {
    return typeof value.path === "string" && value.needsUpdate === false
      ? { state: "installed", path: value.path, needsUpdate: false }
      : null
  }
  if (value.state === "outdated") {
    return typeof value.path === "string" && value.needsUpdate === true
      ? { state: "outdated", path: value.path, needsUpdate: true }
      : null
  }
  if (value.state === "not-installed") {
    return typeof value.targetPath === "string" ? { state: "not-installed", targetPath: value.targetPath } : null
  }
  if (value.state === "cs2-not-found") {
    return { state: "cs2-not-found" }
  }
  if (value.state === "unsupported") {
    return typeof value.reason === "string" ? { state: "unsupported", reason: value.reason } : null
  }
  return null
}

function isPlatform(value: unknown): value is SetupPlatform {
  return value === "windows" || value === "linux" || value === "unsupported"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
