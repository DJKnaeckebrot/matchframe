export const GSI_FIXTURE_VARIANTS = [
  "live",
  "healthy",
  "damaged",
  "dead",
  "sides-switched",
  "equipment",
  "observer",
] as const

export type GsiFixtureVariant = (typeof GSI_FIXTURE_VARIANTS)[number]

const liveFixturePath = new URL("../fixtures/inferno-live.json", import.meta.url)

export async function loadGsiFixture(
  variant: GsiFixtureVariant = "live"
): Promise<unknown> {
  const payload = structuredClone(await Bun.file(liveFixturePath).json()) as GsiDemo
  applyVariant(payload, variant)
  padRosters(payload)
  if (variant === "equipment") {
    applyEquipmentLoadouts(payload)
  }
  return payload
}

type GsiDemo = {
  player?: { steamid?: string; name?: string }
  map?: {
    team_ct?: GsiTeam
    team_t?: GsiTeam
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
}

function applyVariant(payload: GsiDemo, variant: GsiFixtureVariant): void {
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

function padRosters(payload: GsiDemo): void {
  const allplayers = payload.allplayers ?? {}
  payload.allplayers = allplayers
  padTeam(allplayers, "CT", [
    { id: "76561198000000007", name: "Ash" },
    { id: "76561198000000008", name: "Quill" },
  ])
  padTeam(allplayers, "T", [
    { id: "76561198000000009", name: "Rook" },
    { id: "76561198000000010", name: "Pike" },
  ])
}

function padTeam(
  allplayers: Record<string, GsiDemoPlayer>,
  team: "CT" | "T",
  extras: readonly { id: string; name: string }[]
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
