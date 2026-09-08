import { NEUTRAL_PORTRAIT_ID } from "@workspace/presentation"

import ctDefault01 from "./matchframe/ct_default_01.svg"
import ctDefault02 from "./matchframe/ct_default_02.svg"
import ctDefault03 from "./matchframe/ct_default_03.svg"
import tDefault01 from "./matchframe/t_default_01.svg"
import tDefault02 from "./matchframe/t_default_02.svg"
import tDefault03 from "./matchframe/t_default_03.svg"
import neutral from "./matchframe/neutral.svg"

/**
 * Replaceable portrait artwork. Keys are stable operator / fallback ids.
 * Unknown ids → caller falls back to initials / empty plate.
 */
const PORTRAIT_ASSETS: Readonly<Record<string, string>> = {
  ct_default_01: ctDefault01,
  ct_default_02: ctDefault02,
  ct_default_03: ctDefault03,
  t_default_01: tDefault01,
  t_default_02: tDefault02,
  t_default_03: tDefault03,
  [NEUTRAL_PORTRAIT_ID]: neutral,
}

export function getPortraitAsset(id: string): string | undefined {
  return PORTRAIT_ASSETS[id]
}
