import { gsiPayloadSchema, type GsiPayload } from "./schema"

export type ParseGsiSuccess = {
  success: true
  data: GsiPayload
}

export type ParseGsiFailure = {
  success: false
  error: string
  details: readonly { path: string; message: string }[]
}

export type ParseGsiResult = ParseGsiSuccess | ParseGsiFailure

export function parseGsiPayload(input: unknown): ParseGsiResult {
  const result = gsiPayloadSchema.safeParse(input)
  if (!result.success) {
    return {
      success: false,
      error: "Invalid GSI payload",
      details: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    }
  }

  return { success: true, data: result.data }
}
