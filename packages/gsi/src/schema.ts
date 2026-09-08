import { z } from "zod"

const gsiWeaponSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  state: z.string().optional(),
  ammo_clip: z.number().optional(),
  ammo_reserve: z.number().optional(),
})

const gsiPlayerStateSchema = z.object({
  health: z.number().optional(),
  armor: z.number().optional(),
  helmet: z.boolean().optional(),
  money: z.number().optional(),
  defusekit: z.boolean().optional(),
})

const gsiMatchStatsSchema = z.object({
  kills: z.number().optional(),
  assists: z.number().optional(),
  deaths: z.number().optional(),
})

const gsiPlayerSchema = z.object({
  steamid: z.string().optional(),
  name: z.string().optional(),
  team: z.string().optional(),
  state: gsiPlayerStateSchema.optional(),
  match_stats: gsiMatchStatsSchema.optional(),
  weapons: z.record(z.string(), gsiWeaponSchema).optional(),
  position: z.string().optional(),
  forward: z.string().optional(),
})

const gsiTeamSchema = z.object({
  name: z.string().optional(),
  score: z.number().optional(),
})

const gsiMapSchema = z.object({
  name: z.string().optional(),
  phase: z.string().optional(),
  round: z.number().optional(),
  team_ct: gsiTeamSchema.optional(),
  team_t: gsiTeamSchema.optional(),
  round_wins: z.record(z.string(), z.string()).optional(),
})

const gsiRoundSchema = z.object({
  phase: z.string().optional(),
  win_team: z.string().optional(),
  bomb: z.string().optional(),
})

const gsiPhaseCountdownsSchema = z.object({
  phase: z.string().optional(),
  phase_ends_in: z.union([z.number(), z.string()]).optional(),
})

const gsiBombSchema = z.object({
  state: z.string().optional(),
  player: z.string().optional(),
  position: z.string().optional(),
  countdown: z.union([z.number(), z.string()]).optional(),
})

const gsiProviderSchema = z.object({
  timestamp: z.number().optional(),
})

export const gsiPayloadSchema = z.object({
  provider: gsiProviderSchema.optional(),
  map: gsiMapSchema.optional(),
  round: gsiRoundSchema.optional(),
  player: gsiPlayerSchema.optional(),
  allplayers: z.record(z.string(), gsiPlayerSchema).optional(),
  bomb: gsiBombSchema.optional(),
  phase_countdowns: gsiPhaseCountdownsSchema.optional(),
})

export type GsiPayload = z.infer<typeof gsiPayloadSchema>
export type GsiPlayer = z.infer<typeof gsiPlayerSchema>
export type GsiWeapon = z.infer<typeof gsiWeaponSchema>
export type GsiTeam = z.infer<typeof gsiTeamSchema>
