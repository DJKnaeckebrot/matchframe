import { describe, expect, test } from "bun:test"

import { THEME_CSS_VARS, themeToCssVars } from "./css"
import { defaultTheme } from "./default"
import { matchframeThemeSchema } from "./schema"

describe("matchframeThemeSchema", () => {
  test("accepts the default theme", () => {
    const parsed = matchframeThemeSchema.safeParse(defaultTheme)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).toEqual(defaultTheme)
    }
  })

  test("rejects missing tokens", () => {
    const { danger: _danger, ...rest } = defaultTheme
    expect(matchframeThemeSchema.safeParse(rest).success).toBe(false)
  })

  test("rejects invalid color strings", () => {
    const cases = [
      { ...defaultTheme, accent: "" },
      { ...defaultTheme, accent: "not-a-color" },
      { ...defaultTheme, ct: "#zzzzzz" },
      { ...defaultTheme, text: "red" },
      { ...defaultTheme, danger: "url(https://example.com)" },
    ]

    for (const value of cases) {
      expect(matchframeThemeSchema.safeParse(value).success).toBe(false)
    }
  })

  test("accepts hex, rgb, and hsl values", () => {
    const parsed = matchframeThemeSchema.safeParse({
      ...defaultTheme,
      accent: "#c4a",
      ct: "rgb(91, 135, 168)",
      terrorist: "hsl(22, 49%, 46%)",
    })
    expect(parsed.success).toBe(true)
  })
})

describe("themeToCssVars", () => {
  test("maps semantic tokens onto overlay variables", () => {
    const vars = themeToCssVars(defaultTheme)
    expect(vars[THEME_CSS_VARS.surface]).toBe(defaultTheme.surface)
    expect(vars[THEME_CSS_VARS.terrorist]).toBe(defaultTheme.terrorist)
    expect(vars[THEME_CSS_VARS.ct]).toBe(defaultTheme.ct)
  })
})
