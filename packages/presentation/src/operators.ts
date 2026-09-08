import type { OperatorPortrait, Side } from "./types"

/** Stable ids. Overlay maps these to a replaceable asset pack. */
export const OPERATOR_PORTRAITS: readonly OperatorPortrait[] = [
  { id: "ct_default_01", side: "CT", label: "Sentinel" },
  { id: "ct_default_02", side: "CT", label: "Marshal" },
  { id: "ct_default_03", side: "CT", label: "Vanguard" },
  { id: "t_default_01", side: "T", label: "Outlaw" },
  { id: "t_default_02", side: "T", label: "Raider" },
  { id: "t_default_03", side: "T", label: "Ash" },
]

export const OPERATOR_IDS: ReadonlySet<string> = new Set(
  OPERATOR_PORTRAITS.map((operator) => operator.id)
)

export const SIDE_DEFAULT_OPERATOR: Readonly<Record<Side, string>> = {
  CT: "ct_default_01",
  T: "t_default_01",
}

export const NEUTRAL_PORTRAIT_ID = "neutral"

export function isOperatorId(value: string): boolean {
  return OPERATOR_IDS.has(value)
}

export function operatorsForSide(side: Side): readonly OperatorPortrait[] {
  return OPERATOR_PORTRAITS.filter((operator) => operator.side === side)
}

export function operatorById(id: string): OperatorPortrait | undefined {
  return OPERATOR_PORTRAITS.find((operator) => operator.id === id)
}
