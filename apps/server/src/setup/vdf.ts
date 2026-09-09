export type VdfValue = string | VdfObject
export type VdfObject = { readonly [key: string]: VdfValue | readonly VdfValue[] }

export function parseVdf(text: string): VdfObject {
  const tokens = tokenize(text)
  if (tokens.length === 0) {
    return {}
  }
  if (tokens[0] !== "{" && tokens[1] === "{") {
    const key = tokens[0]
    if (key === undefined) {
      throw new Error("Expected VDF key")
    }
    const { value, next } = parseObject(tokens, 1)
    if (next < tokens.length) {
      throw new Error("Unexpected tokens after VDF object")
    }
    return { [key]: value }
  }
  const { value, next } = parseObject(tokens, 0)
  if (next < tokens.length) {
    throw new Error("Unexpected tokens after VDF object")
  }
  return value
}

export type SteamLibraryFolder = {
  path: string
  appIds: readonly string[]
}

export function parseLibraryFolders(text: string): SteamLibraryFolder[] {
  let root: VdfObject
  try {
    root = parseVdf(text)
  } catch {
    return []
  }
  const folders = firstObject(root, "libraryfolders") ?? firstObject(root, "LibraryFolders") ?? root
  const libraries: SteamLibraryFolder[] = []

  for (const [key, value] of Object.entries(folders)) {
    if (isRecord(value)) {
      const path = stringField(value, "path")
      if (!path) {
        continue
      }
      libraries.push({ path: unescapePath(path), appIds: appIdsFrom(value) })
      continue
    }
    if (typeof value === "string" && /^\d+$/.test(key)) {
      libraries.push({ path: unescapePath(value), appIds: [] })
    }
  }

  return libraries
}

function appIdsFrom(folder: VdfObject): string[] {
  const apps = firstObject(folder, "apps")
  if (!apps) {
    return []
  }
  return Object.keys(apps).filter((key) => /^\d+$/.test(key))
}

function firstObject(object: VdfObject, key: string): VdfObject | null {
  const value = object[key]
  if (isRecord(value)) {
    return value
  }
  if (Array.isArray(value)) {
    const first = value.find((entry) => isRecord(entry))
    return isRecord(first) ? first : null
  }
  return null
}

function stringField(object: VdfObject, key: string): string | null {
  const value = object[key]
  return typeof value === "string" ? value : null
}

function unescapePath(value: string): string {
  return value.replaceAll("\\\\", "\\")
}

function parseObject(tokens: readonly string[], start: number): { value: VdfObject; next: number } {
  if (tokens[start] !== "{") {
    throw new Error("Expected {")
  }
  let i = start + 1
  const object: Record<string, VdfValue | VdfValue[]> = {}
  while (i < tokens.length && tokens[i] !== "}") {
    const key = tokens[i]
    if (key === undefined || key === "{") {
      throw new Error("Expected key")
    }
    i += 1
    const next = tokens[i]
    if (next === "{") {
      const child = parseObject(tokens, i)
      setField(object, key, child.value)
      i = child.next
      continue
    }
    if (next === undefined || next === "}") {
      throw new Error("Expected value")
    }
    setField(object, key, next)
    i += 1
  }
  if (tokens[i] !== "}") {
    throw new Error("Unclosed VDF object")
  }
  return { value: object, next: i + 1 }
}

function setField(object: Record<string, VdfValue | VdfValue[]>, key: string, value: VdfValue): void {
  const existing = object[key]
  if (existing === undefined) {
    object[key] = value
    return
  }
  if (Array.isArray(existing)) {
    object[key] = [...existing, value]
    return
  }
  object[key] = [existing, value]
}

function tokenize(text: string): string[] {
  const tokens: string[] = []
  let i = 0
  while (i < text.length) {
    const char = text[i]
    if (char === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") {
        i += 1
      }
      continue
    }
    if (char === "{" || char === "}") {
      tokens.push(char)
      i += 1
      continue
    }
    if (char === '"') {
      i += 1
      let value = ""
      while (i < text.length && text[i] !== '"') {
        if (text[i] === "\\" && i + 1 < text.length) {
          value += text[i + 1]
          i += 2
          continue
        }
        value += text[i]
        i += 1
      }
      if (text[i] === '"') {
        i += 1
      }
      tokens.push(value)
      continue
    }
    i += 1
  }
  return tokens
}

function isRecord(value: unknown): value is VdfObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
