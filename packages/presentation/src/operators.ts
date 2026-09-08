import type { OperatorPortrait, Side } from "./types"

/** CS2 operation agents. Artwork is local; ids are Valve inventory names without the customplayer_ prefix. */
export const OPERATOR_PORTRAITS: readonly OperatorPortrait[] = [
  { id: "ctm_st6_variantn", side: "CT", faction: "Brazilian 1st Battalion", label: "Primeiro Tenente" },
  { id: "ctm_fbi_variantb", side: "CT", faction: "FBI", label: "Special Agent Ava" },
  { id: "ctm_fbi_variantg", side: "CT", faction: "FBI HRT", label: "Markus Delrow" },
  { id: "ctm_fbi_varianth", side: "CT", faction: "FBI Sniper", label: "Michael Syfers" },
  { id: "ctm_fbi_variantf", side: "CT", faction: "FBI SWAT", label: "Operator" },
  { id: "ctm_gendarmerie_variantd", side: "CT", faction: "Gendarmerie Nationale", label: "Aspirant" },
  { id: "ctm_gendarmerie_variantc", side: "CT", faction: "Gendarmerie Nationale", label: "Chef d'Escadron Rouchard" },
  { id: "ctm_gendarmerie_variantb", side: "CT", faction: "Gendarmerie Nationale", label: "Chem-Haz Capitaine" },
  { id: "ctm_gendarmerie_variante", side: "CT", faction: "Gendarmerie Nationale", label: "Officer Jacques Beltram" },
  { id: "ctm_gendarmerie_varianta", side: "CT", faction: "Gendarmerie Nationale", label: "Sous-Lieutenant Medic" },
  { id: "ctm_st6_variantk", side: "CT", faction: "KSK", label: "3rd Commando Company" },
  { id: "ctm_st6_variantj", side: "CT", faction: "NSWC SEAL", label: "'Blueberries' Buckshot" },
  { id: "ctm_st6_variantg", side: "CT", faction: "NSWC SEAL", label: "Buckshot" },
  { id: "ctm_st6_varianti", side: "CT", faction: "NSWC SEAL", label: "Lt. Commander Ricksaw" },
  { id: "ctm_st6_variante", side: "CT", faction: "NSWC SEAL", label: "Seal Team 6 Soldier" },
  { id: "ctm_sas_variantg", side: "CT", faction: "NZSAS", label: "D Squadron Officer" },
  { id: "ctm_sas_variantf", side: "CT", faction: "SAS", label: "B Squadron Officer" },
  { id: "ctm_diver_varianta", side: "CT", faction: "SEAL Frogman", label: "Cmdr. Davida 'Goggles' Fernandez" },
  { id: "ctm_diver_variantb", side: "CT", faction: "SEAL Frogman", label: "Cmdr. Frank 'Wet Sox' Baroud" },
  { id: "ctm_diver_variantc", side: "CT", faction: "SEAL Frogman", label: "Lieutenant Rex Krikey" },
  { id: "ctm_swat_variantf", side: "CT", faction: "SWAT", label: "1st Lieutenant Farlow" },
  { id: "ctm_swat_varianth", side: "CT", faction: "SWAT", label: "Bio-Haz Specialist" },
  { id: "ctm_swat_variantj", side: "CT", faction: "SWAT", label: "Chem-Haz Specialist" },
  { id: "ctm_swat_variante", side: "CT", faction: "SWAT", label: "Cmdr. Mae 'Dead Cold' Jamison" },
  { id: "ctm_swat_variantg", side: "CT", faction: "SWAT", label: "John 'Van Healen' Kask" },
  { id: "ctm_swat_variantk", side: "CT", faction: "SWAT", label: "Lieutenant 'Tree Hugger' Farlow" },
  { id: "ctm_swat_varianti", side: "CT", faction: "SWAT", label: "Sergeant Bombson" },
  { id: "ctm_st6_variantl", side: "CT", faction: "TACP Cavalry", label: "'Two Times' McCoy" },
  { id: "ctm_st6_variantm", side: "CT", faction: "USAF TACP", label: "'Two Times' McCoy" },
  { id: "tm_leet_variantg", side: "T", faction: "Elite Crew", label: "Ground Rebel" },
  { id: "tm_leet_variantj", side: "T", faction: "Elite Crew", label: "Jungle Rebel" },
  { id: "tm_leet_varianth", side: "T", faction: "Elite Crew", label: "Osiris" },
  { id: "tm_leet_varianti", side: "T", faction: "Elite Crew", label: "Prof. Shahmat" },
  { id: "tm_leet_variantf", side: "T", faction: "Elite Crew", label: "The Elite Mr. Muhlik" },
  { id: "tm_jungle_raider_variantb2", side: "T", faction: "Guerrilla Warfare", label: "'Medium Rare' Crasswater" },
  { id: "tm_jungle_raider_variantc", side: "T", faction: "Guerrilla Warfare", label: "Arno The Overgrown" },
  { id: "tm_jungle_raider_variantd", side: "T", faction: "Guerrilla Warfare", label: "Col. Mangos Dabisi" },
  { id: "tm_jungle_raider_variantb", side: "T", faction: "Guerrilla Warfare", label: "Crasswater The Forgotten" },
  { id: "tm_jungle_raider_varianta", side: "T", faction: "Guerrilla Warfare", label: "Elite Trapper Solman" },
  { id: "tm_jungle_raider_variantf2", side: "T", faction: "Guerrilla Warfare", label: "Trapper" },
  { id: "tm_jungle_raider_variantf", side: "T", faction: "Guerrilla Warfare", label: "Trapper Aggressor" },
  { id: "tm_jungle_raider_variante", side: "T", faction: "Guerrilla Warfare", label: "Vypa Sista of the Revolution" },
  { id: "tm_phoenix_variantf", side: "T", faction: "Phoenix", label: "Enforcer" },
  { id: "tm_phoenix_variantg", side: "T", faction: "Phoenix", label: "Slingshot" },
  { id: "tm_phoenix_varianth", side: "T", faction: "Phoenix", label: "Soldier" },
  { id: "tm_phoenix_varianti", side: "T", faction: "Phoenix", label: "Street Soldier" },
  { id: "tm_balkan_varianth", side: "T", faction: "Sabre", label: "'The Doctor' Romanov" },
  { id: "tm_balkan_variantj", side: "T", faction: "Sabre", label: "Blackwolf" },
  { id: "tm_balkan_variantf", side: "T", faction: "Sabre", label: "Dragomir" },
  { id: "tm_balkan_varianti", side: "T", faction: "Sabre", label: "Maximus" },
  { id: "tm_balkan_variantg", side: "T", faction: "Sabre", label: "Rezan The Ready" },
  { id: "tm_balkan_variantk", side: "T", faction: "Sabre", label: "Rezan the Redshirt" },
  { id: "tm_balkan_variantl", side: "T", faction: "Sabre Footsoldier", label: "Dragomir" },
  { id: "tm_professional_varf5", side: "T", faction: "The Professionals", label: "Bloody Darryl The Strapped" },
  { id: "tm_professional_varj", side: "T", faction: "The Professionals", label: "Getaway Sally" },
  { id: "tm_professional_varh", side: "T", faction: "The Professionals", label: "Little Kev" },
  { id: "tm_professional_vari", side: "T", faction: "The Professionals", label: "Number K" },
  { id: "tm_professional_varg", side: "T", faction: "The Professionals", label: "Safecracker Voltzmann" },
  { id: "tm_professional_varf3", side: "T", faction: "The Professionals", label: "Sir Bloody Darryl Royale" },
  { id: "tm_professional_varf4", side: "T", faction: "The Professionals", label: "Sir Bloody Loudmouth Darryl" },
  { id: "tm_professional_varf", side: "T", faction: "The Professionals", label: "Sir Bloody Miami Darryl" },
  { id: "tm_professional_varf1", side: "T", faction: "The Professionals", label: "Sir Bloody Silent Darryl" },
  { id: "tm_professional_varf2", side: "T", faction: "The Professionals", label: "Sir Bloody Skullhead Darryl" },
]

export const OPERATOR_IDS: ReadonlySet<string> = new Set(
  OPERATOR_PORTRAITS.map((operator) => operator.id)
)

export const SIDE_DEFAULT_OPERATOR: Readonly<Record<Side, string>> = {
  CT: "ctm_sas_variantf",
  T: "tm_phoenix_varianth",
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

export function operatorsGroupedByFaction(
  side: Side
): readonly { faction: string; operators: readonly OperatorPortrait[] }[] {
  const groups: { faction: string; operators: OperatorPortrait[] }[] = []
  for (const operator of operatorsForSide(side)) {
    const last = groups.at(-1)
    if (last && last.faction === operator.faction) {
      last.operators.push(operator)
      continue
    }
    groups.push({ faction: operator.faction, operators: [operator] })
  }
  return groups
}
