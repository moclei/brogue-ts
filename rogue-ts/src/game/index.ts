/*
 *  game/index.ts — Barrel exports for the game loop module
 *  brogue-ts
 *
 *  Re-exports all public functions, types, and constants from:
 *    - game-init.ts     (initializeRogue, welcome, setPlayerDisplayChar, etc.)
 *    - game-level.ts    (startLevel, updateColors)
 *    - game-lifecycle.ts (gameOver, victory, enableEasyMode)
 *    - game-cleanup.ts  (freeCreature, removeDeadMonsters, freeEverything, unflag)
 */

// ===== game-init =====
export {
    // Functions
    initializeRogue,
    initializeGameVariant,
    welcome,
    setPlayerDisplayChar,
    printBrogueVersion,
    getOrdinalSuffix,
    fileExists,
    chooseFile,
    openFile,

    // Constants
    RNG_SUBSTANTIVE,
    RNG_COSMETIC,
    D_IMMORTAL,
    D_OMNISCENCE,
    EXIT_STATUS_SUCCESS,

    // Types
    type GameInitContext,
    type GameInitRogueState,
} from "./game-init.js";

// ===== game-level =====
export {
    // Functions
    startLevel,
    updateColors,

    // Types
    type LevelContext,
    type LevelRogueState,
    type LevelFeeling,
} from "./game-level.js";

// ===== game-lifecycle =====
export {
    // Functions
    gameOver,
    victory,
    enableEasyMode,

    // Constants
    GAMEOVER_DEATH,
    GAMEOVER_QUIT,
    GAMEOVER_VICTORY,
    GAMEOVER_SUPERVICTORY,
    GAMEOVER_RECORDING,

    // Types
    type LifecycleContext,
    type LifecycleRogueState,
} from "./game-lifecycle.js";

// ===== game-cleanup =====
export {
    // Functions
    freeCreature,
    removeDeadMonsters,
    freeEverything,
    unflag,

    // Types
    type CleanupContext,
    type CleanupRogueState,
} from "./game-cleanup.js";
