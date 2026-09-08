import type { GameState, PlayerState, TeamState } from "./types"

const OVERLAP_THRESHOLD = 0.5
const SIDE_SLOT_IDS = new Set(["ct", "t"])
const SIDE_LABEL_NAMES = new Set(["CT", "T"])

/**
 * Logical team identity is independent of CT/T side.
 *
 * Match previous teams by Steam ID roster overlap when possible:
 * score = |intersection| / min(|a|, |b|), threshold 0.5, at least one shared id.
 * Greedy 1-to-1 so two snapshot teams cannot claim the same previous id.
 *
 * Fallback: unique name match when the name is not a side label (CT/T).
 * Last resort: keep a non-side-slot snapshot id, else mint team-1, team-2, …
 *
 * ponytail: overlap heuristic, not tournament rosters. Upgrade: explicit org ids.
 */
export function assignTeamIdentity(
  previous: GameState | null,
  snapshot: GameState
): GameState {
  const usedIds = new Set<string>()
  const idMap = new Map<string, string>()

  if (previous) {
    for (const team of previous.teams) {
      usedIds.add(team.id)
    }
    const usedPrev = new Set<string>()
    assignByOverlap(previous, snapshot, idMap, usedIds, usedPrev)
    assignByName(previous, snapshot, idMap, usedIds, usedPrev)
  }

  let mint = nextMintIndex(usedIds)
  for (const team of snapshot.teams) {
    if (idMap.has(team.id)) {
      continue
    }
    const provisional = team.id
    if (!SIDE_SLOT_IDS.has(provisional) && !usedIds.has(provisional)) {
      idMap.set(team.id, provisional)
      usedIds.add(provisional)
      continue
    }
    while (usedIds.has(`team-${mint}`)) {
      mint += 1
    }
    const minted = `team-${mint}`
    mint += 1
    idMap.set(team.id, minted)
    usedIds.add(minted)
  }

  return orderTeams(previous, rewriteIds(snapshot, idMap))
}

function assignByOverlap(
  previous: GameState,
  snapshot: GameState,
  idMap: Map<string, string>,
  usedIds: Set<string>,
  usedPrev: Set<string>
): void {
  const candidates: { nextId: string; prevId: string; score: number }[] = []
  for (const nextTeam of snapshot.teams) {
    const nextRoster = steamIdsForTeam(snapshot, nextTeam.id)
    for (const prevTeam of previous.teams) {
      const score = rosterOverlap(nextRoster, steamIdsForTeam(previous, prevTeam.id))
      if (score >= OVERLAP_THRESHOLD) {
        candidates.push({ nextId: nextTeam.id, prevId: prevTeam.id, score })
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score)
  const usedNext = new Set<string>()
  for (const candidate of candidates) {
    if (usedNext.has(candidate.nextId) || usedPrev.has(candidate.prevId)) {
      continue
    }
    idMap.set(candidate.nextId, candidate.prevId)
    usedNext.add(candidate.nextId)
    usedPrev.add(candidate.prevId)
    usedIds.add(candidate.prevId)
  }
}

function assignByName(
  previous: GameState,
  snapshot: GameState,
  idMap: Map<string, string>,
  usedIds: Set<string>,
  usedPrev: Set<string>
): void {
  for (const nextTeam of snapshot.teams) {
    if (idMap.has(nextTeam.id) || SIDE_LABEL_NAMES.has(nextTeam.name)) {
      continue
    }
    const match = previous.teams.find(
      (team) =>
        !usedPrev.has(team.id) &&
        team.name === nextTeam.name &&
        !SIDE_LABEL_NAMES.has(team.name)
    )
    if (!match) {
      continue
    }
    idMap.set(nextTeam.id, match.id)
    usedPrev.add(match.id)
    usedIds.add(match.id)
  }
}

function steamIdsForTeam(state: GameState, teamId: string): Set<string> {
  const ids = new Set<string>()
  for (const player of state.players) {
    if (player.teamId === teamId) {
      ids.add(player.steamId)
    }
  }
  return ids
}

function rosterOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0
  }
  let intersection = 0
  for (const id of a) {
    if (b.has(id)) {
      intersection += 1
    }
  }
  if (intersection < 1) {
    return 0
  }
  return intersection / Math.min(a.size, b.size)
}

function nextMintIndex(usedIds: Set<string>): number {
  let max = 0
  for (const id of usedIds) {
    const match = /^team-(\d+)$/.exec(id)
    if (match) {
      max = Math.max(max, Number(match[1]))
    }
  }
  return max + 1
}

function rewriteIds(snapshot: GameState, idMap: Map<string, string>): GameState {
  const teams: TeamState[] = snapshot.teams.map((team) => ({
    ...team,
    id: idMap.get(team.id) ?? team.id,
  }))
  const players: PlayerState[] = snapshot.players.map((player) => ({
    ...player,
    teamId: idMap.get(player.teamId) ?? player.teamId,
  }))
  return { ...snapshot, teams, players }
}

function orderTeams(previous: GameState | null, state: GameState): GameState {
  if (!previous) {
    return state
  }
  const index = new Map(previous.teams.map((team, i) => [team.id, i]))
  const teams = [...state.teams].sort((a, b) => {
    const ai = index.get(a.id) ?? Number.MAX_SAFE_INTEGER
    const bi = index.get(b.id) ?? Number.MAX_SAFE_INTEGER
    return ai - bi
  })
  return { ...state, teams }
}
