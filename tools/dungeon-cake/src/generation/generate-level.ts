/*
 *  generate-level.ts — Construct ArchitectContext and run digDungeon
 *  dungeon-cake
 */

import type { Pcell, GameConstants } from "@game/types/types.js";
import type { ArchitectContext } from "@game/architect/architect.js";
import type { MachineContext, MachineItem } from "@game/architect/machines.js";
import { digDungeon } from "@game/architect/architect.js";
import { seedRandomGenerator } from "@game/math/rng.js";

import { tileCatalog } from "@game/globals/tile-catalog.js";
import { dungeonProfileCatalog } from "@game/globals/dungeon-profile-catalog.js";
import { dungeonFeatureCatalog } from "@game/globals/dungeon-feature-catalog.js";
import { blueprintCatalog } from "@game/globals/blueprint-catalog.js";
import { autoGeneratorCatalog } from "@game/globals/autogenerator-catalog.js";
import { BROGUE_GAME_CONSTANTS } from "@game/game/game-constants.js";

import {
    createPmap,
    itemOps,
    monsterOps,
    makeArchitectCallbacks,
    makeBridgeContext,
} from "./stubs.js";

function makeGameConstants(): GameConstants {
    const gc = { ...BROGUE_GAME_CONSTANTS };
    gc.numberBlueprints = blueprintCatalog.length;
    gc.numberAutogenerators = autoGeneratorCatalog.length;
    return gc;
}

export interface GeneratedLevel {
    pmap: Pcell[][];
    depth: number;
    seed: number;
}

export function generateLevel(depth: number, seed: number): GeneratedLevel {
    const pmap = createPmap();
    const gameConstants = makeGameConstants();

    seedRandomGenerator(BigInt(seed));

    const callbacks = makeArchitectCallbacks(pmap, tileCatalog, dungeonFeatureCatalog);

    const machineContext: MachineContext = {
        pmap,
        chokeMap: callbacks.chokeMap,
        tileCatalog,
        blueprintCatalog,
        dungeonFeatureCatalog,
        dungeonProfileCatalog,
        autoGeneratorCatalog,
        depthLevel: depth,
        machineNumber: 0,
        rewardRoomsGenerated: 0,
        staleLoopMap: true,
        gameConstants,
        itemOps,
        monsterOps,
        analyzeMap: callbacks.analyzeMapWrap,
        calculateDistances: callbacks.calcDistWrap,
        getFOVMask: callbacks.getFOVMaskWrap,
        populateGenericCostMap: callbacks.costMapWrap,
        pathingDistance: callbacks.pathDistWrap,
        floorItems: [] as MachineItem[],
        packItems: [] as MachineItem[],
    };

    const archCtx: ArchitectContext = {
        pmap,
        depthLevel: depth,
        gameConstants,
        dungeonProfileCatalog,
        dungeonFeatureCatalog,
        blueprintCatalog,
        autoGeneratorCatalog,
        tileCatalog,
        machineNumber: 0,
        rewardRoomsGenerated: 0,
        staleLoopMap: true,
        machineContext,
        bridgeContext: makeBridgeContext(depth, callbacks),
        analyzeMap: callbacks.analyzeMapWrap,
        getFOVMask: callbacks.getFOVMaskWrap,
        populateGenericCostMap: callbacks.costMapWrap,
        calculateDistances: callbacks.calcDistWrap,
    };

    digDungeon(archCtx);

    return { pmap, depth, seed };
}
