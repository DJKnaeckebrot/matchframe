import { describe, expect, test } from "bun:test"

import {
  OPERATOR_PORTRAITS,
  SIDE_DEFAULT_OPERATOR,
  isOperatorId,
  operatorById,
  operatorsGroupedByFaction,
} from "./operators"

describe("CS2 operator catalog", () => {
  test("side defaults are SAS and Phoenix Soldier", () => {
    expect(SIDE_DEFAULT_OPERATOR.CT).toBe("ctm_sas_variantf")
    expect(SIDE_DEFAULT_OPERATOR.T).toBe("tm_phoenix_varianth")
    expect(isOperatorId(SIDE_DEFAULT_OPERATOR.CT)).toBe(true)
    expect(isOperatorId(SIDE_DEFAULT_OPERATOR.T)).toBe(true)
  })

  test("groups CT agents by faction", () => {
    const fbi = operatorsGroupedByFaction("CT").find((group) => group.faction === "FBI")
    expect(fbi?.operators.map((operator) => operator.id)).toEqual(["ctm_fbi_variantb"])
    expect(operatorById("ctm_fbi_variantb")?.label).toBe("Special Agent Ava")
  })

  test("every catalog id is unique", () => {
    const ids = OPERATOR_PORTRAITS.map((operator) => operator.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
