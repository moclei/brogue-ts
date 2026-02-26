/*
 *  constants.ts — Port of constants from Rogue.h
 *  brogue-ts
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

// Brogue version
export const BROGUE_MAJOR = 1;
export const BROGUE_MINOR = 15;
export const BROGUE_PATCH = 1;

// Debug / mode flags (these become runtime checks in TS)
export const DELETE_SAVE_FILE_AFTER_LOADING = true;
export const KEYBOARD_LABELS = true;

// ----- Grid dimensions -----

export const MESSAGE_LINES = 3;
export const MESSAGE_ARCHIVE_VIEW_LINES_FACTOR = 10; // MESSAGE_ARCHIVE_LINES = MESSAGE_ARCHIVE_VIEW_LINES * 10
export const MAX_MESSAGE_REPEATS = 100;

export const COLS = 100;
export const ROWS = 31 + MESSAGE_LINES; // 34

export const TEXT_MAX_LENGTH = COLS * ROWS * 2;

export const STAT_BAR_WIDTH = 20;
// DCOLS: dungeon columns (map area width)
export const DCOLS = COLS - STAT_BAR_WIDTH - 1; // 79
// DROWS: dungeon rows (map area height)
export const DROWS = ROWS - MESSAGE_LINES - 2; // 29

export const MESSAGE_ARCHIVE_VIEW_LINES = ROWS;
export const MESSAGE_ARCHIVE_LINES = MESSAGE_ARCHIVE_VIEW_LINES * MESSAGE_ARCHIVE_VIEW_LINES_FACTOR;
export const MESSAGE_ARCHIVE_ENTRIES = MESSAGE_ARCHIVE_LINES * 4;

// ----- Rendering / lighting -----

export const LOS_SLOPE_GRANULARITY = 32768;
export const INTERFACE_OPACITY = 95;
export const LIGHT_SMOOTHING_THRESHOLD = 150;
export const MAX_BOLT_LENGTH = DCOLS * 10;
export const VISIBILITY_THRESHOLD = 50;

// ----- Machines -----

export const MACHINES_BUFFER_LENGTH = 200;

// ----- Recording -----

export const INPUT_RECORD_BUFFER = 1000;
export const INPUT_RECORD_BUFFER_MAX_SIZE = 1100;
export const DEFAULT_PLAYBACK_DELAY = 50;

// ----- High scores -----

export const HIGH_SCORES_COUNT = 30;

// ----- Color escapes -----

export const COLOR_ESCAPE = 25;
export const COLOR_VALUE_INTERCEPT = 25;

// ----- Gameplay constants -----

export const TURNS_FOR_FULL_REGEN = 300;
export const STOMACH_SIZE = 2150;
export const HUNGER_THRESHOLD = STOMACH_SIZE - 1800;
export const WEAK_THRESHOLD = 150;
export const FAINT_THRESHOLD = 50;
export const MAX_EXP_LEVEL = 20;
export const MAX_EXP = 100000000;

export const XPXP_NEEDED_FOR_TELEPATHIC_BOND = 1400;

// ----- Room/corridor dimensions -----

export const ROOM_MIN_WIDTH = 4;
export const ROOM_MAX_WIDTH = 20;
export const ROOM_MIN_HEIGHT = 3;
export const ROOM_MAX_HEIGHT = 7;
export const HORIZONTAL_CORRIDOR_MIN_LENGTH = 5;
export const HORIZONTAL_CORRIDOR_MAX_LENGTH = 15;
export const VERTICAL_CORRIDOR_MIN_LENGTH = 2;
export const VERTICAL_CORRIDOR_MAX_LENGTH = 9;
export const CROSS_ROOM_MIN_WIDTH = 3;
export const CROSS_ROOM_MAX_WIDTH = 12;
export const CROSS_ROOM_MIN_HEIGHT = 2;
export const CROSS_ROOM_MAX_HEIGHT = 5;
export const MIN_SCALED_ROOM_DIMENSION = 2;

export const ROOM_TYPE_COUNT = 8;
export const CORRIDOR_WIDTH = 1;

export const WAYPOINT_SIGHT_RADIUS = 10;
export const MAX_WAYPOINT_COUNT = 40;

export const MAX_ITEMS_IN_MONSTER_ITEMS_HOPPER = 100;

export const CAVE_MIN_WIDTH = 50;
export const CAVE_MIN_HEIGHT = 20;

// ----- Keyboard commands -----

export const UP_KEY = "k".charCodeAt(0);
export const DOWN_KEY = "j".charCodeAt(0);
export const LEFT_KEY = "h".charCodeAt(0);
export const RIGHT_KEY = "l".charCodeAt(0);
export const UP_ARROW = 63232;
export const LEFT_ARROW = 63234;
export const DOWN_ARROW = 63233;
export const RIGHT_ARROW = 63235;
export const UPLEFT_KEY = "y".charCodeAt(0);
export const UPRIGHT_KEY = "u".charCodeAt(0);
export const DOWNLEFT_KEY = "b".charCodeAt(0);
export const DOWNRIGHT_KEY = "n".charCodeAt(0);
export const DESCEND_KEY = ">".charCodeAt(0);
export const ASCEND_KEY = "<".charCodeAt(0);
export const REST_KEY = "z".charCodeAt(0);
export const AUTO_REST_KEY = "Z".charCodeAt(0);
export const SEARCH_KEY = "s".charCodeAt(0);
export const INVENTORY_KEY = "i".charCodeAt(0);
export const ACKNOWLEDGE_KEY = " ".charCodeAt(0);
export const EQUIP_KEY = "e".charCodeAt(0);
export const UNEQUIP_KEY = "r".charCodeAt(0);
export const APPLY_KEY = "a".charCodeAt(0);
export const THROW_KEY = "t".charCodeAt(0);
export const RETHROW_KEY = "T".charCodeAt(0);
export const RELABEL_KEY = "R".charCodeAt(0);
export const SWAP_KEY = "w".charCodeAt(0);
export const TRUE_COLORS_KEY = "\\".charCodeAt(0);
export const STEALTH_RANGE_KEY = "]".charCodeAt(0);
export const DROP_KEY = "d".charCodeAt(0);
export const CALL_KEY = "c".charCodeAt(0);
export const QUIT_KEY = "Q".charCodeAt(0);
export const MESSAGE_ARCHIVE_KEY = "M".charCodeAt(0);
export const BROGUE_HELP_KEY = "?".charCodeAt(0);
export const DISCOVERIES_KEY = "D".charCodeAt(0);
export const FEATS_KEY = "F".charCodeAt(0);
export const CREATE_ITEM_MONSTER_KEY = "C".charCodeAt(0);
export const EXPLORE_KEY = "x".charCodeAt(0);
export const AUTOPLAY_KEY = "A".charCodeAt(0);
export const SEED_KEY = "~".charCodeAt(0);
export const EASY_MODE_KEY = "&".charCodeAt(0);
export const ESCAPE_KEY = 0x1b; // '\033'
export const RETURN_KEY = 0x0a; // '\012'
export const DELETE_KEY = 0x7f; // '\177'
export const TAB_KEY = 0x09; // '\t'
export const SHIFT_TAB_KEY = 25;
export const PERIOD_KEY = ".".charCodeAt(0);
export const VIEW_RECORDING_KEY = "V".charCodeAt(0);
export const LOAD_SAVED_GAME_KEY = "O".charCodeAt(0);
export const SAVE_GAME_KEY = "S".charCodeAt(0);
export const NEW_GAME_KEY = "N".charCodeAt(0);
export const GRAPHICS_KEY = "G".charCodeAt(0);
export const SWITCH_TO_PLAYING_KEY = "P".charCodeAt(0);
export const NUMPAD_0 = 48;
export const NUMPAD_1 = 49;
export const NUMPAD_2 = 50;
export const NUMPAD_3 = 51;
export const NUMPAD_4 = 52;
export const NUMPAD_5 = 53;
export const NUMPAD_6 = 54;
export const NUMPAD_7 = 55;
export const NUMPAD_8 = 56;
export const NUMPAD_9 = 57;
export const PAGE_UP_KEY = 63276;
export const PAGE_DOWN_KEY = 63277;
export const PRINTSCREEN_KEY = 0x2c; // '\054'
export const UNKNOWN_KEY = 128 + 19;

// ----- File names -----

export const LAST_GAME_NAME = "LastGame";
export const LAST_RECORDING_NAME = "LastRecording";
export const RECORDING_SUFFIX = ".broguerec";
export const GAME_SUFFIX = ".broguesave";
export const ANNOTATION_SUFFIX = ".txt";
export const RNG_LOG = "RNGLog.txt";
export const SCREENSHOT_SUFFIX = ".png";
export const DATE_FORMAT = "%Y-%m-%d";

export const BROGUE_FILENAME_MAX = 4096;
export const ERROR_MESSAGE_LENGTH = 100;

// ----- Misc -----

export const NUMBER_DYNAMIC_COLORS = 6;
export const NUMBER_ITEM_CATEGORIES = 13;
export const MAX_PACK_ITEMS = 26;
export const NUMBER_MUTATORS = 8;
export const MONSTER_CLASS_COUNT = 15;

export const NUMBER_ITEM_TITLES = 14;
export const NUMBER_ITEM_COLORS = 21;
export const NUMBER_TITLE_PHONEMES = 21;
export const NUMBER_ITEM_WOODS = 21;
export const NUMBER_POTION_DESCRIPTIONS = 18;
export const NUMBER_ITEM_METALS = 12;
export const NUMBER_ITEM_GEMS = 18;

export const KEY_ID_MAXIMUM = 20;

export const PDS_FORBIDDEN = -1;
export const PDS_OBSTRUCTION = -2;

export const BUTTON_TEXT_SIZE = COLS * 3;
export const FEAT_NAME_LENGTH = 15;

export const MIN_COLOR_DIFF = 600;

export const NUMBER_TERRAIN_LAYERS = 4;
