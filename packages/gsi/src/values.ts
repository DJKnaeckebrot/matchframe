import type { Vector3 } from "@workspace/game-state"

export function parseGsiNumber(value: number | string | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

export function parseVector3(value: string | undefined): Vector3 | undefined {
  if (!value) {
    return undefined
  }
  const parts = value.split(",").map((part) => Number(part.trim()))
  const [x, y, z] = parts
  if (
    parts.length < 3 ||
    x === undefined ||
    y === undefined ||
    z === undefined ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(z)
  ) {
    return undefined
  }
  return { x, y, z }
}
