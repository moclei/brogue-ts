# C Function Inventory

Generated from `src/brogue/` — game logic layer only.
Each section lists function definitions found in that file.

## IO.c

- Line 109:static pos getClosestValidLocationOnMap(short **map, short x, short y) {
- Line 134:static void processSnapMap(short **map) {
- Line 170:static short actionMenu(short x, boolean playingBack) {
- Line 443:static void initializeMenuButtons(buttonState *state, brogueButton buttons[5]) {
- Line 928:static void bakeTerrainColors(color *foreColor, color *backColor, short x, short y) {
- Line 1053:static boolean glyphIsWallish(enum displayGlyph glyph) {
- Line 1076:static enum monsterTypes randomAnimateMonster() {
- Line 1584:static short randomizeByPercent(short input, short percent) {
- Line 1728:static short adjustedLightValue(short x) {
- Line 2206:static void displayWaypoints() {
- Line 2226:static void displayMachines() {
- Line 2264:static void displayChokeMap() {
- Line 2289:static void displayLoops() {
- Line 2313:static void exploreKey(const boolean controlKey) {
- Line 3009:static void dequeueEvent() {
- Line 3021:static archivedMessage *getArchivedMessage(short back) {
- Line 3025:static int formatCountedMessage(char *buffer, size_t size, archivedMessage *m) {
- Line 3044:static short foldMessages(char buffer[COLS*20], short offset, unsigned long *turnOutput) {
- Line 3100:static void capitalizeAndPunctuateSentences(char *text, short length) {
- Line 3124:static void splitLines(short lines, char wrapped[COLS*20], char buffer[][COLS*2], short bufferCursor) {
- Line 3225:static void drawMessageArchive(char messages[MESSAGE_ARCHIVE_LINES][COLS*2], short length, short offset, short height) {
- Line 3256:static void animateMessageArchive(boolean opening, char messages[MESSAGE_ARCHIVE_LINES][COLS*2], short length, short offset, short height) {
- Line 3287:static short scrollMessageArchive(char messages[MESSAGE_ARCHIVE_LINES][COLS*2], short length, short offset, short height) {
- Line 3933:static void breakUpLongWordsIn(char *sourceText, short width, boolean useHyphens) {
- Line 4139:static void printDiscoveries(short category, short count, unsigned short itemCharacter, short x, short y, screenDisplayBuffer *dbuf) {
- Line 4475:static short estimatedArmorValue() {
- Line 4480:static short creatureHealthChangePercent(creature *monst) {

## Items.c

- Line 81:static unsigned long pickItemCategory(unsigned long theCategory) {
- Line 157:static boolean itemIsThrowingWeapon(const item *theItem) {
- Line 463:static void fillItemSpawnHeatMap(unsigned short heatMap[DCOLS][DROWS], unsigned short heatLevel, pos loc) {
- Line 484:static void coolHeatMapAt(unsigned short heatMap[DCOLS][DROWS], pos loc, unsigned long *totalHeat) {
- Line 508:static boolean getItemSpawnLoc(unsigned short heatMap[DCOLS][DROWS], short *x, short *y, unsigned long *totalHeat) {
- Line 806:static boolean itemWillStackWithPack(item *theItem) {
- Line 926:static void conflateItemCharacteristics(item *newItem, item *oldItem) {
- Line 945:static void stackItems(item *newItem, item *oldItem) {
- Line 956:static boolean inventoryLetterAvailable(char proposedLetter) {
- Line 1075:static boolean itemIsSwappable(const item *theItem) {
- Line 1085:static void swapItemToEnchantLevel(item *theItem, short newEnchant, boolean enchantmentKnown) {
- Line 1142:static boolean enchantLevelKnown(const item *theItem) {
- Line 1152:static short effectiveEnchantLevel(const item *theItem) {
- Line 1160:static boolean swapItemEnchants(const short machineNumber) {
- Line 1292:static boolean inscribeItem(item *theItem) {
- Line 1760:static int enchantMagnitude() {
- Line 1814:static fixpt enchantIncrement(item *theItem) {
- Line 1839:static short effectiveRingEnchant(item *theItem) {
- Line 1850:static short apparentRingBonus(const enum ringKind kind) {
- Line 1869:static boolean monsterClassHasAcidicMonster(const short classID) {
- Line 2761:static boolean displayMagicCharForItem(item *theItem) {
- Line 3305:static boolean keyMatchesLocation(item *theItem, pos loc) {
- Line 3605:static boolean impermissibleKinkBetween(short x1, short y1, short x2, short y2) {
- Line 3631:static boolean tunnelize(short x, short y) {
- Line 3690:static boolean negationWillAffectMonster(creature *monst, boolean isBolt) {
- Line 3841:static boolean polymorph(creature *monst) {
- Line 3976:static void makePlayerTelepathic(short duration) {
- Line 3989:static void rechargeItems(unsigned long categories) {
- Line 4073:static void negationBlast(const char *emitterName, const short distance) {
- Line 4129:static void discordBlast(const char *emitterName, const short distance) {
- Line 4150:static void crystalize(short radius) {
- Line 4187:static boolean imbueInvisibility(creature *monst, short duration) {
- Line 4322:static void beckonMonster(creature *monst, short x, short y) {
- Line 4720:static void detonateBolt(bolt *theBolt, creature *caster, short x, short y, boolean *autoID) {
- Line 5181:static boolean itemMagicPolarityIsKnown(const item *theItem, int magicPolarity) {
- Line 5197:static boolean canAutoTargetMonster(const creature *monst, const item *theItem, enum autoTargetMode targetingMode) {
- Line 5328:static short hiliteTrajectory(const pos coordinateList[DCOLS], short numCells, boolean eraseHiliting, const bolt *theBolt, const color *hiliteColor) {
- Line 5587:static pos pullMouseClickDuringPlayback(void) {
- Line 5834:static int tryGetLastUnidentifiedItemKind(enum itemCategory category, int polarityConstraint) {
- Line 5855:static int magicPolarityRevealedItemKindCount(enum itemCategory category, int polarityConstraint) {
- Line 5881:static void tryIdentifyLastItemKind(enum itemCategory category, int polarityConstraint) {
- Line 5904:static void tryIdentifyLastItemKinds(enum itemCategory category) {
- Line 5999:static boolean hitMonsterWithProjectileWeapon(creature *thrower, creature *monst, item *theItem) {
- Line 6080:static void throwItem(item *theItem, creature *thrower, pos targetLoc, short maxDistance) {
- Line 6470:static boolean playerCancelsBlinking(const pos originLoc, const pos targetLoc, const short maxDistance) {
- Line 6533:static void recordApplyItemCommand(item *theItem) {
- Line 6545:static boolean useStaffOrWand(item *theItem) {
- Line 6651:static void summonGuardian(item *theItem) {
- Line 6671:static void consumePackItem(item *theItem) {
- Line 6716:static boolean useCharm(item *theItem) {
- Line 6857:static short lotteryDraw(short *frequencies, short itemCount) {
- Line 6938:static void magicMapCell(short x, short y) {
- Line 6949:static boolean uncurse( item *theItem ) {
- Line 7225:static void detectMagicOnItem(item *theItem) {
- Line 7541:static boolean canDrop() {
- Line 7942:static void resetItemTableEntry(itemTable *theEntry) {

## Monsters.c

- Line 297:static boolean attackWouldBeFutile(const creature *attacker, const creature *defender) {
- Line 694:static boolean spawnMinions(short hordeID, creature *leader, boolean summoned, boolean itemPossible) {
- Line 758:static boolean drawManacle(pos loc, enum directions dir) {
- Line 771:static void drawManacles(pos loc) {
- Line 976:static boolean summonMinions(creature *summoner) {
- Line 1197:static boolean isValidWanderDestination(creature *monst, short wpIndex) {
- Line 1205:static short closestWaypointIndex(creature *monst) {
- Line 1251:static unsigned long successorTerrainFlags(enum tileType tile, enum subseqDFTypes promotionType) {
- Line 1515:static boolean moveMonsterPassivelyTowards(creature *monst, pos targetLoc, boolean willingToAttackPlayer) {
- Line 1608:static boolean monsterCanShootWebs(creature *monst) {
- Line 1621:static short awarenessDistance(creature *observer, creature *target) {
- Line 1649:static boolean awareOfTarget(creature *observer, creature *target) {
- Line 1685:static short closestWaypointIndexTo(pos p) {
- Line 1699:static void wanderToward(creature *monst, pos destination) {
- Line 2079:static enum boltType monsterHasBoltEffect(creature *monst, enum boltEffects boltEffectIndex) {
- Line 2089:static void pathTowardCreature(creature *monst, creature *target) {
- Line 2134:static boolean creatureEligibleForSwarming(creature *monst) {
- Line 2160:static enum directions monsterSwarmDirection(creature *monst, creature *enemy) {
- Line 2363:static boolean fleeingMonsterAwareOfPlayer(creature *monst) {
- Line 2371:static short **getSafetyMap(creature *monst) {
- Line 2394:static boolean monsterBlinkToSafety(creature *monst) {
- Line 2534:static boolean generallyValidBoltTarget(creature *caster, creature *target) {
- Line 2563:static boolean targetEligibleForCombatBuff(creature *caster, creature *target) {
- Line 2587:static boolean specificallyValidBoltTarget(creature *caster, creature *target, enum boltType theBoltType) {
- Line 2755:static void monsterCastSpell(creature *caster, creature *target, enum boltType boltIndex) {
- Line 2777:static boolean monstUseBolt(creature *monst) {
- Line 2808:static boolean monstUseMagic(creature *monst) {
- Line 2817:static boolean isLocalScentMaximum(pos loc) {
- Line 2833:static enum directions scentDirection(creature *monst) {
- Line 2988:static boolean allyFlees(creature *ally, creature *closestEnemy) {
- Line 3019:static void monsterMillAbout(creature *monst, short movementChance) {
- Line 3040:static void moveAlly(creature *monst) {
- Line 3250:static boolean updateMonsterCorpseAbsorption(creature *monst) {
- Line 4207:static void getMonsterDominationText(char *buf, const creature *monst) {
- Line 4245:static void buildProperCommaString(char *dest, char *newText) {
- Line 4288:static void getMonsterAbilitiesText(const creature *monst, char *abilitiesText, boolean includeNegatable, boolean includeNonNegatable) {
- Line 4373:static boolean staffOrWandEffectOnMonsterDescription(char *newText, item *theItem, creature *monst) {
- Line 4447:static void summarizePack (packSummary *pack) {

## Architect.c

- Line 48:static inline boolean cellIsPassableOrDoor(short x, short y) {
- Line 57:static boolean checkLoopiness(short x, short y) {
- Line 121:static void auditLoop(short x, short y, char grid[DCOLS][DROWS]) {
- Line 140:static short floodFillCount(char results[DCOLS][DROWS], char passMap[DCOLS][DROWS], short startX, short startY) {
- Line 340:static void addLoops(short **grid, short minimumPathingDistance) {
- Line 400:static boolean addTileToMachineInteriorAndIterate(char interior[DCOLS][DROWS], short startX, short startY) {
- Line 431:static void copyMap(pcell from[DCOLS][DROWS], pcell to[DCOLS][DROWS]) {
- Line 441:static boolean itemIsADuplicate(item *theItem, item **spawnedItems, short itemCount) {
- Line 455:static boolean blueprintQualifies(short i, unsigned long requiredMachineFlags) {
- Line 470:static void abortItemsAndMonsters(item *spawnedItems[MACHINES_BUFFER_LENGTH], creature *spawnedMonsters[MACHINES_BUFFER_LENGTH]) {
- Line 591:static void addLocationToKey(item *theItem, short x, short y, boolean disposableHere) {
- Line 599:static void addMachineNumberToKey(item *theItem, short machineNumber, boolean disposableHere) {
- Line 607:static void expandMachineInterior(char interior[DCOLS][DROWS], short minimumInteriorNeighbors) {
- Line 674:static boolean fillInteriorForVestibuleMachine(char interior[DCOLS][DROWS], short bp, short originX, short originY) {
- Line 734:static void redesignInterior(char interior[DCOLS][DROWS], short originX, short originY, short theProfileIndex) {
- Line 856:static void prepareInteriorWithMachineFlags(char interior[DCOLS][DROWS], short originX, short originY, unsigned long flags, short dungeonProfileIndex) {
- Line 1732:static void addMachines() {
- Line 1780:static void runAutogenerators(boolean buildAreaMachines) {
- Line 1856:static void cleanUpLakeBoundaries() {
- Line 1913:static void removeDiagonalOpenings() {
- Line 1951:static void insertRoomAt(short **dungeonMap, short **roomMap, const short roomToDungeonX, const short roomToDungeonY, const short xRoom, const short yRoom) {
- Line 1971:static void designCavern(short **grid, short minWidth, short maxWidth, short minHeight, short maxHeight) {
- Line 2005:static void designEntranceRoom(short **grid) {
- Line 2023:static void designCrossRoom(short **grid) {
- Line 2043:static void designSymmetricalCrossRoom(short **grid) {
- Line 2064:static void designSmallRoom(short **grid) {
- Line 2073:static void designCircularRoom(short **grid) {
- Line 2091:static void designChunkyRoom(short **grid) {
- Line 2126:static enum directions directionOfDoorSite(short **grid, short x, short y) {
- Line 2155:static void chooseRandomDoorSites(short **roomMap, pos doorSites[4]) {
- Line 2205:static void attachHallwayTo(short **grid, pos doorSites[4]) {
- Line 2344:static boolean roomFitsAt(short **dungeonMap, short **roomMap, short roomToDungeonX, short roomToDungeonY) {
- Line 2425:static void adjustDungeonProfileForDepth(dungeonProfile *theProfile) {
- Line 2436:static void adjustDungeonFirstRoomProfileForDepth(dungeonProfile *theProfile) {
- Line 2456:static void carveDungeon(short **grid) {
- Line 2480:static void finishWalls(boolean includingDiagonals) {
- Line 2518:static void liquidType(short *deep, short *shallow, short *shallowWidth) {
- Line 2554:static void fillLake(short x, short y, short liquid, short scanWidth, char wreathMap[DCOLS][DROWS], short **unfilledLakeMap) {
- Line 2569:static void lakeFloodFill(short x, short y, short **floodMap, short **grid, short **lakeMap, short dungeonToGridX, short dungeonToGridY) {
- Line 2588:static boolean lakeDisruptsPassability(short **grid, short **lakeMap, short dungeonToGridX, short dungeonToGridY) {
- Line 2638:static void designLakes(short **lakeMap) {
- Line 2689:static void createWreath(short shallowLiquid, short wreathWidth, char wreathMap[DCOLS][DROWS]) {
- Line 2710:static void fillLakes(short **lakeMap) {
- Line 2733:static void finishDoors() {
- Line 2760:static void clearLevel() {
- Line 2786:static boolean buildABridge() {
- Line 3109:static short connectCell(short x, short y, short zoneLabel, char blockingMap[DCOLS][DROWS], char zoneMap[DCOLS][DROWS]) {
- Line 3332:static void evacuateCreatures(char blockingMap[DCOLS][DROWS]) {
- Line 3604:static boolean validStairLoc(short x, short y) {
- Line 3656:static void prepareForStairs(short x, short y, char grid[DCOLS][DROWS]) {

## Movement.c

- Line 498:static void moveEntrancedMonsters(enum directions dir) {
- Line 558:static boolean abortAttackAgainstAcidicTarget(const creature *hitList[8]) {
- Line 591:static boolean abortAttackAgainstDiscordantAlly(const creature *hitList[8]) {
- Line 617:static boolean abortAttack(const creature *hitList[8]) {
- Line 801:static void buildFlailHitList(const short x, const short y, const short newX, const short newY, const creature *hitList[16]) {
- Line 1536:static void displayRoute(short **distanceMap, boolean removeRoute) {
- Line 1611:static void travelMap(short **distanceMap) {

## Time.c

- Line 457:static void applyGradualTileEffectsToCreature(creature *monst, short ticks) {
- Line 600:static void updateTelepathy() {
- Line 649:static void updateScent() {
- Line 804:static void checkNutrition() {
- Line 867:static void flashCreatureAlert(creature *monst, char msg[200], const color *foreColor, const color *backColor) {
- Line 883:static void handleHealthAlerts() {
- Line 931:static void addXPXPToAlly(creature *monst) {
- Line 956:static void handleXPXP() {
- Line 977:static void playerFalls() {
- Line 1224:static void updateVolumetricMedia() {
- Line 1324:static void updateYendorWardenTracking() {
- Line 1584:static void resetDistanceCellInGrid(short **grid, short x, short y) {
- Line 1772:static void processIncrementalAutoID() {
- Line 1871:static void monsterEntersLevel(creature *monst, short n) {
- Line 1946:static void monstersApproachStairs() {
- Line 1969:static void decrementPlayerStatus() {
- Line 2077:static boolean dangerChanged(boolean danger[4]) {
- Line 2205:static void recordCurrentCreatureHealths() {

## Combat.c

- Line 148:static void addMonsterToContiguousMonsterGrid(short x, short y, creature *monst, char grid[DCOLS][DROWS]) {
- Line 167:static short alliedCloneCount(creature *monst) {
- Line 369:static boolean playerImmuneToMonster(creature *monst) {
- Line 382:static void specialHit(creature *attacker, creature *defender, short damage) {
- Line 498:static boolean forceWeaponHit(creature *defender, item *theItem) {
- Line 788:static void attackVerb(char returnString[DCOLS], creature *attacker, short hitPercentile) {
- Line 983:static void decrementWeaponAutoIDTimer() {
- Line 1367:static boolean canAbsorb(creature *ally, boolean ourBolts[], creature *prey, short **grid) {
- Line 1401:static boolean anyoneWantABite(creature *decedent) {

## RogueMain.c

- Line 118:static void screen_update_benchmark() {
- Line 137:static const char *getOrdinalSuffix(int number) {
- Line 157:static void welcome() {
- Line 538:static void updateColors() {
- Line 930:static void freeGlobalDynamicGrid(short ***grid) {
- Line 951:static void removeDeadMonstersFromList(creatureList *list) {

## MainMenu.c

- Line 42:static void drawMenuFlames(signed short flames[COLS][(ROWS + MENU_FLAME_ROW_PADDING)][3], unsigned char mask[COLS][ROWS]) {
- Line 161:static void antiAlias(unsigned char mask[COLS][ROWS]) {
- Line 256:static void initializeMainMenuButton(brogueButton *button, char *textWithHotkey, unsigned long hotkey1, unsigned long hotkey2, enum NGCommands command) {
- Line 275:static void initializeMainMenuButtons(brogueButton *buttons) {
- Line 295:static void stackButtons(brogueButton *buttons, short buttonCount, windowpos startPosition, short spacing, boolean topToBottomFlag) {
- Line 319:static void initializeMenu(buttonState *menu, brogueButton *buttons, short buttonCount, screenDisplayBuffer *shadowBuf) {
- Line 351:static void initializeMainMenu(buttonState *menu, brogueButton *buttons, windowpos position, screenDisplayBuffer *shadowBuf) {
- Line 363:static void initializeFlyoutMenu(buttonState *menu, screenDisplayBuffer *shadowBuf, brogueButton *buttons, windowpos position) {
- Line 390:static void chooseGameVariant() {
- Line 430:static void chooseGameMode() {
- Line 471:static boolean isFlyoutActive() {
- Line 479:static windowpos getNextGameButtonPos(brogueButton *buttons) {
- Line 491:static void redrawMainMenuButtons(buttonState *menu, screenDisplayBuffer *button_dbuf) {
- Line 507:static void titleMenu() {
- Line 652:static boolean stringsExactlyMatch(const char *string1, const char *string2) {
- Line 667:static int fileEntryCompareDates(const void *a, const void *b) {
- Line 891:static void addRuntoGameStats(rogueRun *run, gameStats *stats) {
- Line 938:static void viewGameStats(void) {

## Buttons.c


## Light.c

- Line 156:static void updateDisplayDetail() {
- Line 197:static void recordOldLights() {
- Line 321:static boolean flareIsActive(flare *theFlare) {
- Line 341:static boolean updateFlare(flare *theFlare) {
- Line 351:static boolean drawFlareFrame(flare *theFlare) {

## Recordings.c

- Line 43:static void recordChar(unsigned char c) {
- Line 52:static void considerFlushingBufferToFile() {
- Line 59:static unsigned char compressKeystroke(long c) {
- Line 73:static void numberToString(uint64_t number, short numberOfBytes, unsigned char *recordTo) {
- Line 86:static void recordNumber(unsigned long number, short numberOfBytes) {
- Line 177:static void writeHeaderInfo(char *path) {
- Line 266:static unsigned char recallChar() {
- Line 279:static long uncompressKeystroke(unsigned char c) {
- Line 286:static uint64_t recallNumber(short numberOfBytes) {
- Line 305:static void playbackPanic() {
- Line 385:static void loadNextAnnotation() {
- Line 459:static boolean getPatchVersion(char *versionString, unsigned short *patchVersion) {
- Line 599:static boolean unpause() {
- Line 611:static void printPlaybackHelpScreen() {
- Line 667:static void resetPlayback() {
- Line 689:static void seek(unsigned long seekTarget, enum recordingSeekModes seekMode) {
- Line 783:static void promptToAdvanceToLocation(short keystroke) {
- Line 1130:static void getDefaultFilePath(char *defaultPath, boolean gameOver) {
- Line 1263:static void copyFile(char *fromFilePath, char *toFilePath, unsigned long fromFileLength) {
- Line 1373:static void describeKeystroke(unsigned char key, char *description) {
- Line 1405:static void appendModifierKeyDescription(char *description) {
- Line 1417:static boolean selectFile(char *prompt, char *defaultName, char *suffix) {

## Wizard.c

- Line 27:static void initializeCreateItemButton(brogueButton *button, char *text) {
- Line 91:static short dialogCreateItemChooseVorpalEnemy() {
- Line 106:static void dialogCreateItemChooseRunic(item *theItem){
- Line 176:static short dialogCreateItemChooseKind(enum itemCategory category) {
- Line 198:static void dialogCreateItemChooseEnchantmentLevel(item *theItem) {
- Line 265:static int creatureTypeCompareMonsterNames (const void * a, const void * b) {
- Line 280:static void dialogCreateMonsterChooseMutation(creature *theMonster) {
- Line 305:static void dialogCreateMonster() {
- Line 439:static void dialogCreateItem() {

## Grid.c

- Line 183:static void getPassableArcGrid(short **grid, short minPassableArc, short maxPassableArc, short value) {
- Line 210:static short leastPositiveValueInGrid(short **grid) {
- Line 249:static pos randomLeastPositiveLocationInGrid(short **grid, boolean deterministic) {
- Line 362:static void cellularAutomataRound(short **grid, char birthParameters[9], char survivalParameters[9]) {
- Line 396:static short fillContiguousRegion(short **grid, short x, short y, short fillValue) {

## Math.c

- Line 97:static u4 ranval( ranctx *x ) {
- Line 106:static void raninit( ranctx *x, uint64_t seed ) {
- Line 125:static long range(long n, short RNG) {
- Line 209:static int msbpos(unsigned long long x) {
- Line 218:static fixpt fp_exp2(int n) {

## Dijkstra.c

- Line 42:static void pdsUpdate(pdsMap *map, boolean useDiagonals) {
- Line 92:static void pdsClear(pdsMap *map, short maxDistance) {
- Line 102:static void pdsSetDistance(pdsMap *map, short x, short y, short distance) {
- Line 127:static void pdsBatchInput(pdsMap *map, short **distanceMap, short **costMap, short maxDistance) {
- Line 192:static void pdsBatchOutput(pdsMap *map, short **distanceMap, boolean useDiagonals) {

## PowerTables.c


## SeedCatalog.c

- Line 45:static void getMonsterDetailedName(creature *theMonster, char *theMonsterName) {
- Line 53:static void printSeedCatalogItem(item *theItem, creature *theMonster, boolean isCsvFormat) {
- Line 115:static void printSeedCatalogMonster(creature *theMonster, boolean isCsvFormat) {
- Line 144:static void printSeedCatalogMonsters(boolean isCsvFormat, boolean includeAll) {
- Line 160:static void printSeedCatalogMonsterItems(boolean isCsvFormat) {
- Line 176:static void printSeedCatalogFloorGold(int gold, short piles, boolean isCsvFormat) {
- Line 197:static void printSeedCatalogFloorItems(boolean isCsvFormat) {
- Line 217:static void printSeedCatalogAltars(boolean isCsvFormat) {

## Globals.c


## Utilities.c


---
Generated Thu Mar  5 16:26:12 PST 2026
