import type { IconPack } from "../../../icons/icon-types"

import ak47 from "./equipment/ak47.svg"
import aug from "./equipment/aug.svg"
import awp from "./equipment/awp.svg"
import bizon from "./equipment/bizon.svg"
import c4 from "./equipment/c4.svg"
import cz75a from "./equipment/cz75a.svg"
import deagle from "./equipment/deagle.svg"
import decoy from "./equipment/decoy.svg"
import defuser from "./equipment/defuser.svg"
import elite from "./equipment/elite.svg"
import famas from "./equipment/famas.svg"
import fiveseven from "./equipment/fiveseven.svg"
import flashbang from "./equipment/flashbang.svg"
import g3sg1 from "./equipment/g3sg1.svg"
import galilar from "./equipment/galilar.svg"
import glock from "./equipment/glock.svg"
import hegrenade from "./equipment/hegrenade.svg"
import helmet from "./equipment/helmet.svg"
import incgrenade from "./equipment/incgrenade.svg"
import kevlar from "./equipment/kevlar.svg"
import knife from "./equipment/knife.svg"
import m249 from "./equipment/m249.svg"
import m4a1 from "./equipment/m4a1.svg"
import m4a1Silencer from "./equipment/m4a1_silencer.svg"
import mac10 from "./equipment/mac10.svg"
import mag7 from "./equipment/mag7.svg"
import molotov from "./equipment/molotov.svg"
import mp5sd from "./equipment/mp5sd.svg"
import mp7 from "./equipment/mp7.svg"
import mp9 from "./equipment/mp9.svg"
import negev from "./equipment/negev.svg"
import nova from "./equipment/nova.svg"
import p2000 from "./equipment/p2000.svg"
import p250 from "./equipment/p250.svg"
import p90 from "./equipment/p90.svg"
import revolver from "./equipment/revolver.svg"
import sawedoff from "./equipment/sawedoff.svg"
import scar20 from "./equipment/scar20.svg"
import sg556 from "./equipment/sg556.svg"
import smokegrenade from "./equipment/smokegrenade.svg"
import ssg08 from "./equipment/ssg08.svg"
import tec9 from "./equipment/tec9.svg"
import ump45 from "./equipment/ump45.svg"
import uspSilencer from "./equipment/usp_silencer.svg"
import xm1014 from "./equipment/xm1014.svg"

export const cs2ReferencePack: IconPack = {
  id: "cs2-reference",
  weapons: {
    ak47,
    m4a1_s: m4a1Silencer,
    m4a4: m4a1,
    famas,
    galil: galilar,
    aug,
    sg553: sg556,
    awp,
    ssg08,
    g3sg1,
    scar20,
    mp9,
    mp7,
    mp5sd,
    ump45,
    p90,
    bizon,
    mac10,
    nova,
    xm1014,
    mag7,
    sawedoff,
    m249,
    negev,
    deagle,
    elite,
    fiveseven,
    glock,
    usp_s: uspSilencer,
    p2000,
    p250,
    cz75: cz75a,
    r8: revolver,
    tec9,
    knife,
  },
  utilities: {
    he: hegrenade,
    flash: flashbang,
    smoke: smokegrenade,
    molotov,
    incendiary: incgrenade,
    decoy,
  },
  equipment: {
    helmet,
    armor: kevlar,
    defuse: defuser,
  },
  objectives: {
    bomb: c4,
    defuse: defuser,
  },
}
