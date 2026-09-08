export const GSI_FIXTURE_VARIANTS = [
  "live",
  "healthy",
  "damaged",
  "dead",
  "sides-switched",
  "sides-switched-live",
  "equipment",
  "observer",
  "freeze",
  "4v5",
  "1v2",
  "bomb-planted",
  "bomb-low-time",
  "bomb-defusing",
  "bomb-defusing-low-time",
  "bomb-defused",
  "bomb-exploded",
  "sides-switched-bomb-planted",
  "sides-switched-defusing",
  "round-ct-win",
  "round-t-win",
  "round-over-bomb-defused",
  "radar-anubis",
  "radar-anubis-moved",
  "radar-anubis-bomb-dropped",
  "radar-anubis-bomb-planted",
] as const

export type GsiFixtureVariant = (typeof GSI_FIXTURE_VARIANTS)[number]

const liveFixturePath = new URL("../fixtures/inferno-live.json", import.meta.url)

export async function loadGsiFixture(
  variant: GsiFixtureVariant = "live"
): Promise<unknown> {
  const payload = structuredClone(await Bun.file(liveFixturePath).json()) as GsiDemo
  applyVariant(payload, variant)
  padRosters(payload)
  applyPostPad(payload, variant)
  return payload
}

type GsiDemo = {
  player?: { steamid?: string; name?: string }
  map?: {
    name?: string
    phase?: string
    round?: number
    team_ct?: GsiTeam
    team_t?: GsiTeam
    round_wins?: Record<string, string>
  }
  round?: {
    phase?: string
    win_team?: string
    bomb?: string
  }
  phase_countdowns?: {
    phase?: string
    phase_ends_in?: number | string
  }
  allplayers?: Record<string, GsiDemoPlayer>
  bomb?: {
    state?: string
    player?: string
    position?: string
    countdown?: number | string
  }
}

type GsiTeam = {
  name?: string
  score?: number
}

type GsiDemoWeapon = {
  name: string
  type?: string
  state?: string
  ammo_clip?: number
  ammo_reserve?: number
}

type GsiDemoPlayer = {
  name?: string
  team?: string
  observer_slot?: number
  state?: {
    health?: number
    armor?: number
    helmet?: boolean
    money?: number
    defusekit?: boolean
  }
  match_stats?: {
    kills?: number
    assists?: number
    deaths?: number
  }
  weapons?: Record<string, GsiDemoWeapon>
  position?: string
  forward?: string
}

function applyVariant(payload: GsiDemo, variant: GsiFixtureVariant): void {
  if (variant === "radar-anubis") {
    applyAnubisRadar(payload)
    return
  }
  if (variant === "radar-anubis-moved") {
    applyAnubisRadar(payload)
    moveNovaEast(payload)
    return
  }
  if (variant === "radar-anubis-bomb-dropped") {
    applyAnubisRadar(payload)
    dropBombAtTSpawn(payload)
    return
  }
  if (variant === "radar-anubis-bomb-planted") {
    applyAnubisRadar(payload)
    plantBombAtCtSpawn(payload)
    return
  }
  if (variant === "live" || variant === "equipment") {
    return
  }
  if (variant === "observer") {
    setObserver(payload, "76561198000000004")
    return
  }
  if (variant === "healthy") {
    for (const player of playersOf(payload)) {
      setVitals(player, { health: 100, armor: 100, helmet: true })
    }
    return
  }
  if (variant === "damaged") {
    const list = playersOf(payload)
    const first = list[0]
    const second = list[1]
    if (first) {
      setVitals(first, { health: 37, armor: 0, helmet: false })
    }
    if (second) {
      setVitals(second, { health: 12, armor: 0, helmet: false })
    }
    return
  }
  if (variant === "dead") {
    const list = playersOf(payload)
    const victim = list[list.length - 1]
    if (victim) {
      setVitals(victim, { health: 0, armor: 0, helmet: false })
    }
    return
  }
  if (variant === "freeze") {
    setPhase(payload, "freezetime", "12.0")
    return
  }
  if (variant === "bomb-planted") {
    setPlanted(payload, "28.4")
    return
  }
  if (variant === "bomb-low-time") {
    setPlanted(payload, "5.2")
    return
  }
  if (variant === "bomb-defusing") {
    setDefusing(payload, "4.2")
    return
  }
  if (variant === "bomb-defusing-low-time") {
    setDefusing(payload, "1.1")
    return
  }
  if (variant === "bomb-defused" || variant === "round-over-bomb-defused") {
    setRoundOver(payload, "CT", "ct_win_defuse", "defused")
    return
  }
  if (variant === "bomb-exploded") {
    setRoundOver(payload, "T", "t_win_bomb", "exploded")
    return
  }
  if (variant === "sides-switched-bomb-planted") {
    swapSides(payload)
    setPlanted(payload, "28.4")
    return
  }
  if (variant === "sides-switched-defusing") {
    swapSides(payload)
    setDefusing(payload, "4.2")
    return
  }
  if (variant === "round-ct-win") {
    setRoundOver(payload, "CT", "ct_win_elimination")
    return
  }
  if (variant === "round-t-win") {
    setRoundOver(payload, "T", "t_win_elimination")
    return
  }
  if (
    variant === "sides-switched" ||
    variant === "sides-switched-live" ||
    variant === "4v5" ||
    variant === "1v2"
  ) {
    if (variant === "sides-switched" || variant === "sides-switched-live") {
      swapSides(payload)
    }
    if (variant === "sides-switched-live") {
      setPhase(payload, "live", "83.4")
    }
  }
}

function applyPostPad(payload: GsiDemo, variant: GsiFixtureVariant): void {
  if (variant === "equipment") {
    applyEquipmentLoadouts(payload)
    return
  }
  if (variant === "freeze") {
    reviveAll(payload)
    return
  }
  if (variant === "4v5") {
    setAliveCounts(payload, 4, 5)
    return
  }
  if (variant === "1v2") {
    setAliveCounts(payload, 1, 2)
  }
}

function swapSides(payload: GsiDemo): void {
  const map = payload.map
  if (!map) {
    return
  }
  const ct = map.team_ct
  const t = map.team_t
  map.team_ct = t
  map.team_t = ct
  for (const player of playersOf(payload)) {
    if (player.team === "CT") {
      player.team = "T"
    } else if (player.team === "T") {
      player.team = "CT"
    }
  }
}

function setPhase(payload: GsiDemo, phase: string, endsIn: string): void {
  payload.round = { ...payload.round, phase }
  delete payload.round.win_team
  delete payload.round.bomb
  payload.phase_countdowns = { phase, phase_ends_in: endsIn }
}

function setPlanted(payload: GsiDemo, countdown: string): void {
  payload.round = { ...payload.round, phase: "live", bomb: "planted" }
  delete payload.round.win_team
  payload.phase_countdowns = { phase: "bomb", phase_ends_in: countdown }
  payload.bomb = { state: "planted", countdown }
}

function setDefusing(payload: GsiDemo, countdown: string): void {
  payload.round = { ...payload.round, phase: "live", bomb: "planted" }
  delete payload.round.win_team
  payload.phase_countdowns = { phase: "defuse", phase_ends_in: countdown }
  const bomb: NonNullable<GsiDemo["bomb"]> = { state: "defusing", countdown }
  const defuser = currentSideSteamId(payload, "CT")
  if (defuser) {
    bomb.player = defuser
  }
  payload.bomb = bomb
}

function currentSideSteamId(payload: GsiDemo, side: "CT" | "T"): string | undefined {
  for (const [steamId, player] of Object.entries(payload.allplayers ?? {})) {
    if (player.team === side && (player.state?.health ?? 0) > 0) {
      return steamId
    }
  }
  return undefined
}

function setRoundOver(
  payload: GsiDemo,
  winTeam: "CT" | "T",
  win: string,
  bomb?: "defused" | "exploded"
): void {
  payload.round = { phase: "over", win_team: winTeam }
  if (bomb) {
    payload.round.bomb = bomb
    payload.bomb = { state: bomb }
  } else if (payload.bomb) {
    payload.bomb = { ...payload.bomb, state: "carried" }
  }
  payload.phase_countdowns = { phase: "over", phase_ends_in: "6.0" }
  const round = payload.map?.round ?? 0
  payload.map = {
    ...payload.map,
    round_wins: { ...(payload.map?.round_wins ?? {}), [String(round + 1)]: win },
  }
}

function reviveAll(payload: GsiDemo): void {
  for (const player of playersOf(payload)) {
    if ((player.state?.health ?? 0) <= 0) {
      setVitals(player, { health: 100, armor: 100, helmet: true })
    }
  }
}

function setAliveCounts(payload: GsiDemo, ctAlive: number, tAlive: number): void {
  setTeamAlive(payload, "CT", ctAlive)
  setTeamAlive(payload, "T", tAlive)
}

function setTeamAlive(payload: GsiDemo, team: "CT" | "T", keep: number): void {
  const list = playersOf(payload).filter((player) => player.team === team)
  list.forEach((player, index) => {
    if (index < keep) {
      if ((player.state?.health ?? 0) <= 0) {
        setVitals(player, { health: 100, armor: 0, helmet: false })
      }
      return
    }
    setVitals(player, { health: 0, armor: 0, helmet: false })
  })
}

function padRosters(payload: GsiDemo): void {
  const allplayers = payload.allplayers ?? {}
  payload.allplayers = allplayers
  padTeam(allplayers, "CT", [
    { id: "76561198000000007", name: "Ash", slot: 4 },
    { id: "76561198000000008", name: "Quill", slot: 5 },
  ])
  padTeam(allplayers, "T", [
    { id: "76561198000000009", name: "Rook", slot: 9 },
    { id: "76561198000000010", name: "Pike", slot: 0 },
  ])
}

function padTeam(
  allplayers: Record<string, GsiDemoPlayer>,
  team: "CT" | "T",
  extras: readonly { id: string; name: string; slot: number }[]
): void {
  let count = Object.values(allplayers).filter((player) => player.team === team).length
  for (const extra of extras) {
    if (count >= 5) {
      break
    }
    if (allplayers[extra.id]) {
      continue
    }
    allplayers[extra.id] = {
      name: extra.name,
      team,
      observer_slot: extra.slot,
      state: { health: 100, armor: 100, helmet: true, money: 2700 },
    }
    count += 1
  }
}

function applyEquipmentLoadouts(payload: GsiDemo): void {
  const allplayers = payload.allplayers ?? {}
  setLoadout(allplayers["76561198000000001"], {
    health: 100,
    armor: 100,
    helmet: true,
    money: 2700,
    defusekit: true,
    weapons: [
      knife("holstered"),
      pistol("weapon_usp_silencer", "holstered", 12, 24),
      rifle("weapon_m4a1_silencer", "active", 25, 90),
      nade("weapon_hegrenade"),
      nade("weapon_flashbang", 2),
      nade("weapon_smokegrenade"),
    ],
  })
  setLoadout(allplayers["76561198000000002"], {
    health: 87,
    armor: 50,
    helmet: false,
    money: 1500,
    defusekit: true,
    weapons: [
      knife("holstered"),
      pistol("weapon_hkp2000", "active", 3, 12),
      nade("weapon_flashbang"),
      nade("weapon_decoy"),
    ],
  })
  setLoadout(allplayers["76561198000000003"], {
    health: 100,
    armor: 100,
    helmet: true,
    money: 5400,
    defusekit: true,
    weapons: [
      knife("holstered"),
      pistol("weapon_deagle", "holstered", 7, 28),
      { name: "weapon_awp", type: "SniperRifle", state: "active", ammo_clip: 1, ammo_reserve: 5 },
    ],
  })
  setLoadout(allplayers["76561198000000004"], {
    health: 100,
    armor: 100,
    helmet: true,
    money: 3750,
    weapons: [
      knife("holstered", true),
      pistol("weapon_glock", "holstered", 20, 120),
      rifle("weapon_ak47", "active", 30, 90),
      { name: "weapon_c4", type: "C4", state: "holstered" },
      nade("weapon_molotov"),
      nade("weapon_smokegrenade"),
    ],
  })
  setLoadout(allplayers["76561198000000005"], {
    health: 12,
    armor: 0,
    helmet: false,
    money: 200,
    weapons: [pistol("weapon_glock", "active", 4, 0)],
  })
  setLoadout(allplayers["76561198000000006"], {
    health: 0,
    armor: 0,
    helmet: false,
    money: 2100,
    weapons: [],
  })
  setLoadout(allplayers["76561198000000007"], {
    health: 100,
    armor: 100,
    helmet: true,
    money: 3100,
    defusekit: true,
    weapons: [
      knife("holstered"),
      pistol("weapon_fiveseven", "holstered", 20, 100),
      { name: "weapon_mp9", type: "Submachine Gun", state: "active", ammo_clip: 30, ammo_reserve: 90 },
      nade("weapon_incgrenade"),
    ],
  })
  setLoadout(allplayers["76561198000000008"], {
    health: 64,
    armor: 100,
    helmet: true,
    money: 1800,
    defusekit: true,
    weapons: [
      knife("holstered"),
      pistol("weapon_usp_silencer", "holstered", 12, 24),
      rifle("weapon_m4a1", "active", 12, 40),
      nade("weapon_hegrenade"),
      nade("weapon_flashbang"),
      nade("weapon_incgrenade"),
    ],
  })
  setLoadout(allplayers["76561198000000009"], {
    health: 100,
    armor: 80,
    helmet: true,
    money: 4200,
    weapons: [
      knife("holstered", true),
      pistol("weapon_tec9", "holstered", 18, 90),
      rifle("weapon_ak47", "active", 22, 90),
      nade("weapon_flashbang", 2),
      nade("weapon_hegrenade"),
    ],
  })
  setLoadout(allplayers["76561198000000010"], {
    health: 73,
    armor: 0,
    helmet: false,
    money: 900,
    weapons: [
      knife("holstered", true),
      pistol("weapon_glock", "holstered", 20, 120),
      { name: "weapon_mac10", type: "Submachine Gun", state: "active", ammo_clip: 8, ammo_reserve: 20 },
      nade("weapon_molotov"),
    ],
  })

  payload.bomb = {
    state: "carried",
    player: "76561198000000004",
  }
}

function setLoadout(
  player: GsiDemoPlayer | undefined,
  loadout: {
    health: number
    armor: number
    helmet: boolean
    money: number
    defusekit?: boolean
    weapons: GsiDemoWeapon[]
  }
): void {
  if (!player) {
    return
  }
  player.state = {
    health: loadout.health,
    armor: loadout.armor,
    helmet: loadout.helmet,
    money: loadout.money,
    defusekit: loadout.defusekit,
  }
  const weapons: Record<string, GsiDemoWeapon> = {}
  loadout.weapons.forEach((weapon, index) => {
    weapons[`weapon_${index}`] = weapon
  })
  player.weapons = weapons
}

function knife(state: "active" | "holstered", tSide = false): GsiDemoWeapon {
  return {
    name: tSide ? "weapon_knife_t" : "weapon_knife",
    type: "Knife",
    state,
  }
}

function pistol(
  name: string,
  state: "active" | "holstered",
  ammoClip: number,
  ammoReserve: number
): GsiDemoWeapon {
  return { name, type: "Pistol", state, ammo_clip: ammoClip, ammo_reserve: ammoReserve }
}

function rifle(
  name: string,
  state: "active" | "holstered",
  ammoClip: number,
  ammoReserve: number
): GsiDemoWeapon {
  return { name, type: "Rifle", state, ammo_clip: ammoClip, ammo_reserve: ammoReserve }
}

function nade(name: string, ammoReserve?: number): GsiDemoWeapon {
  const weapon: GsiDemoWeapon = { name, type: "Grenade", state: "holstered" }
  if (ammoReserve !== undefined) {
    weapon.ammo_reserve = ammoReserve
  }
  return weapon
}

function setObserver(payload: GsiDemo, steamId: string): void {
  payload.player = { ...payload.player, steamid: steamId }
  const observed = payload.allplayers?.[steamId]
  if (observed?.name) {
    payload.player.name = observed.name
  }
}

function playersOf(payload: GsiDemo): GsiDemoPlayer[] {
  return Object.values(payload.allplayers ?? {})
}

function setVitals(
  player: GsiDemoPlayer,
  vitals: { health: number; armor: number; helmet: boolean }
): void {
  player.state = {
    ...player.state,
    health: vitals.health,
    armor: vitals.armor,
    helmet: vitals.helmet,
  }
}

/**
 * Positions are inverted from CS2 `de_anubis.txt` overview spawn markers
 * (CTSpawn 0.61,0.22 / TSpawn 0.58,0.93) with Valve pos_x/pos_y/scale.
 * Not a live-demo capture. Z is unused by the 2D radar and set to 0.
 */
const ANUBIS = {
  posX: -2796,
  posY: 3328,
  scale: 5.22,
  size: 1024,
} as const

function anubisWorld(radarX: number, radarY: number): string {
  const x = ANUBIS.posX + radarX * ANUBIS.scale * ANUBIS.size
  const y = ANUBIS.posY - radarY * ANUBIS.scale * ANUBIS.size
  return `${x}, ${y}, 0`
}

function applyAnubisRadar(payload: GsiDemo): void {
  payload.map = { ...payload.map, name: "de_anubis" }
  const allplayers = payload.allplayers ?? {}
  const east = 40 / ANUBIS.size
  const south = 40 / ANUBIS.size
  place(allplayers["76561198000000001"], anubisWorld(0.61, 0.22), "0, 1, 0")
  place(allplayers["76561198000000002"], anubisWorld(0.61 + east, 0.22), "1, 0, 0")
  place(allplayers["76561198000000003"], anubisWorld(0.61, 0.22 + south), "0, -1, 0")
  place(allplayers["76561198000000004"], anubisWorld(0.58, 0.93), "0, 1, 0")
  place(allplayers["76561198000000005"], anubisWorld(0.58 + east, 0.93), "-1, 0, 0")
  place(allplayers["76561198000000006"], anubisWorld(0.58, 0.93 - south), "0, -1, 0")
}

function moveNovaEast(payload: GsiDemo): void {
  const nova = payload.allplayers?.["76561198000000001"]
  if (!nova) {
    return
  }
  place(nova, anubisWorld(0.71, 0.22), nova.forward ?? "0, 1, 0")
}

function dropBombAtTSpawn(payload: GsiDemo): void {
  payload.bomb = { state: "dropped", position: anubisWorld(0.58, 0.93) }
}

function plantBombAtCtSpawn(payload: GsiDemo): void {
  payload.round = { ...payload.round, phase: "live", bomb: "planted" }
  delete payload.round.win_team
  payload.phase_countdowns = { phase: "bomb", phase_ends_in: "28.4" }
  payload.bomb = { state: "planted", countdown: "28.4", position: anubisWorld(0.61, 0.22) }
}

function place(
  player: GsiDemoPlayer | undefined,
  position: string,
  forward: string
): void {
  if (!player) {
    return
  }
  player.position = position
  player.forward = forward
}
