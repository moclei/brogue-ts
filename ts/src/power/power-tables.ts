/*
 *  power-tables.ts — Power/enchantment lookup tables and calculation functions
 *  brogue-ts
 *
 *  Ported from PowerTables.c
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Fixpt, CharmEffectTableEntry } from "../types/types.js";
import { FP_FACTOR, fpPow, fpSqrt } from "../math/fixpt.js";
import { randClumpedRange } from "../math/rng.js";
import {
    TURNS_FOR_FULL_REGEN,
    CHARM_EFFECT_DURATION_INCREMENT_ARRAY_SIZE,
    NUMBER_GOOD_WEAPON_ENCHANT_KINDS,
} from "../types/constants.js";

// =============================================================================
// Helpers
// =============================================================================

function clamp(val: number, min: number, max: number): number {
    return val < min ? min : val > max ? max : val;
}

function lastIndex(arr: readonly unknown[]): number {
    return arr.length - 1;
}

// =============================================================================
// Staff functions — "enchant" parameters must already be multiplied by FP_FACTOR
// =============================================================================

export function staffDamageLow(enchant: Fixpt): number {
    return Number((2n + enchant / FP_FACTOR) * 3n / 4n);
}

export function staffDamageHigh(enchant: Fixpt): number {
    return Number(4n + (5n * enchant / FP_FACTOR / 2n));
}

export function staffDamage(enchant: Fixpt): number {
    return randClumpedRange(
        staffDamageLow(enchant),
        staffDamageHigh(enchant),
        1 + Number(enchant / 3n / FP_FACTOR),
    );
}

export function staffBlinkDistance(enchant: Fixpt): number {
    return Number(2n + enchant * 2n / FP_FACTOR);
}

export function staffHasteDuration(enchant: Fixpt): number {
    return Number(2n + enchant * 4n / FP_FACTOR);
}

export function staffBladeCount(enchant: Fixpt): number {
    return Number(enchant * 3n / 2n / FP_FACTOR);
}

export function staffDiscordDuration(enchant: Fixpt): number {
    return Number(enchant * 4n / FP_FACTOR);
}

export function staffEntrancementDuration(enchant: Fixpt): number {
    return Number(enchant * 3n / FP_FACTOR);
}

export function staffProtection(enchant: Fixpt): number {
    return Number(130n * fpPow(FP_FACTOR * 140n / 100n, Number(enchant / FP_FACTOR - 2n)) / FP_FACTOR);
}

// =============================================================================
// Staff Poison
// =============================================================================

const POW_POISON: readonly Fixpt[] = Object.freeze([
    // 1.3^x fixed point, with x from 0 to 50 in increments of 1:
    65536n, 85196n, 110755n, 143982n, 187177n, 243330n, 316329n, 411228n, 534597n, 694976n,
    903469n, 1174510n, 1526863n, 1984922n, 2580398n, 3354518n, 4360874n, 5669136n, 7369877n,
    9580840n, 12455093n, 16191620n, 21049107n, 27363839n, 35572991n, 46244888n, 60118355n,
    78153861n, 101600020n, 132080026n, 171704034n, 223215244n, 290179818n, 377233763n,
    490403892n, 637525060n, 828782579n, 1077417352n, 1400642558n, 1820835326n, 2367085924n,
    3077211701n, 4000375211n, 5200487775n, 6760634107n, 8788824340n, 11425471642n,
    14853113134n, 19309047075n, 25101761197n, 32632289557n,
]);

export function staffPoison(enchant: Fixpt): number {
    const idx = clamp(Number(enchant / FP_FACTOR - 2n), 0, lastIndex(POW_POISON));
    return Number(5n * POW_POISON[idx] / FP_FACTOR);
}

// =============================================================================
// Ring Wisdom
// =============================================================================

const POW_WISDOM: readonly Fixpt[] = Object.freeze([
    // 1.3^x fixed point, with x from -10 to 30 in increments of 1:
    4753n, 6180n, 8034n, 10444n, 13577n, 17650n, 22945n, 29829n, 38778n, 50412n,
    65536n, 85196n, 110755n, 143982n, 187177n, 243330n, 316329n, 411228n, 534597n, 694976n,
    903469n, 1174510n, 1526863n, 1984922n, 2580398n, 3354518n, 4360874n, 5669136n, 7369877n,
    9580840n, 12455093n, 16191620n, 21049107n, 27363839n, 35572991n, 46244888n, 60118355n,
    78153861n, 101600020n, 132080026n, 171704034n,
]);

export function ringWisdomMultiplier(enchant: Fixpt): Fixpt {
    const minEnchant = enchant / FP_FACTOR < 27n ? enchant / FP_FACTOR : 27n;
    const idx = clamp(Number(minEnchant + 10n), 0, lastIndex(POW_WISDOM));
    return POW_WISDOM[idx];
}

// =============================================================================
// Weapon enchantment functions
// =============================================================================

export function weaponParalysisDuration(enchant: Fixpt): number {
    return Math.max(2, Number(2n + enchant / 2n / FP_FACTOR));
}

export function weaponConfusionDuration(enchant: Fixpt): number {
    return Math.max(3, Number(enchant * 3n / 2n / FP_FACTOR));
}

export function weaponForceDistance(enchant: Fixpt): number {
    return Math.max(4, Number(enchant * 2n / FP_FACTOR + 2n));
}

export function weaponSlowDuration(enchant: Fixpt): number {
    return Math.max(3, Number(((enchant / FP_FACTOR + 2n) * (enchant + 2n * FP_FACTOR)) / 3n / FP_FACTOR));
}

export function weaponImageCount(enchant: Fixpt): number {
    return clamp(Number(enchant / 3n / FP_FACTOR), 1, 7);
}

export function weaponImageDuration(_enchant: Fixpt): number {
    return 3;
}

// =============================================================================
// Armor enchantment functions
// =============================================================================

export function armorReprisalPercent(enchant: Fixpt): number {
    return Math.max(5, Number(enchant * 5n / FP_FACTOR));
}

export function armorAbsorptionMax(enchant: Fixpt): number {
    return Math.max(1, Number(enchant / FP_FACTOR));
}

export function armorImageCount(enchant: Fixpt): number {
    return clamp(Number(enchant / 3n / FP_FACTOR), 1, 5);
}

// =============================================================================
// Reflection Chance
// =============================================================================

const POW_REFLECT: readonly Fixpt[] = Object.freeze([
    // 0.85^x fixed point, with x from 0.25 to 50 in increments of 0.25:
    62926n, 60421n, 58015n, 55705n, 53487n, 51358n, 49313n, 47349n, 45464n, 43654n, 41916n,
    40247n, 38644n, 37106n, 35628n, 34210n, 32848n, 31540n, 30284n, 29078n, 27920n, 26809n,
    25741n, 24716n, 23732n, 22787n, 21880n, 21009n, 20172n, 19369n, 18598n, 17857n, 17146n,
    16464n, 15808n, 15179n, 14574n, 13994n, 13437n, 12902n, 12388n, 11895n, 11421n, 10967n,
    10530n, 10111n, 9708n, 9321n, 8950n, 8594n, 8252n, 7923n, 7608n, 7305n, 7014n, 6735n,
    6466n, 6209n, 5962n, 5724n, 5496n, 5278n, 5067n, 4866n, 4672n, 4486n, 4307n, 4136n,
    3971n, 3813n, 3661n, 3515n, 3375n, 3241n, 3112n, 2988n, 2869n, 2755n, 2645n, 2540n,
    2439n, 2341n, 2248n, 2159n, 2073n, 1990n, 1911n, 1835n, 1762n, 1692n, 1624n, 1559n,
    1497n, 1438n, 1380n, 1325n, 1273n, 1222n, 1173n, 1127n, 1082n, 1039n, 997n, 958n,
    919n, 883n, 848n, 814n, 781n, 750n, 720n, 692n, 664n, 638n, 612n, 588n, 564n, 542n,
    520n, 500n, 480n, 461n, 442n, 425n, 408n, 391n, 376n, 361n, 346n, 333n, 319n, 307n,
    294n, 283n, 271n, 261n, 250n, 240n, 231n, 221n, 213n, 204n, 196n, 188n, 181n, 173n,
    166n, 160n, 153n, 147n, 141n, 136n, 130n, 125n, 120n, 115n, 111n, 106n, 102n, 98n,
    94n, 90n, 87n, 83n, 80n, 77n, 74n, 71n, 68n, 65n, 62n, 60n, 58n, 55n, 53n, 51n, 49n,
    47n, 45n, 43n, 41n, 40n, 38n, 37n, 35n, 34n, 32n, 31n, 30n, 29n, 27n, 26n, 25n, 24n,
    23n, 22n, 21n, 21n, 20n, 19n,
]);

export function reflectionChance(enchant: Fixpt): number {
    const idx = clamp(Number(enchant * 4n / FP_FACTOR - 1n), 0, lastIndex(POW_REFLECT));
    return clamp(100 - Number(100n * POW_REFLECT[idx] / FP_FACTOR), 1, 100);
}

// =============================================================================
// Regeneration
// =============================================================================

const POW_REGEN: readonly Fixpt[] = Object.freeze([
    // 0.75^x fixed point, with x from -10 to 50 in increments of 1:
    1163770n, 872827n, 654620n, 490965n, 368224n, 276168n, 207126n, 155344n, 116508n, 87381n,
    65536n, 49152n, 36864n, 27648n, 20736n, 15552n, 11664n, 8748n, 6561n, 4920n, 3690n,
    2767n, 2075n, 1556n, 1167n, 875n, 656n, 492n, 369n, 277n, 207n, 155n, 116n, 87n, 65n,
    49n, 36n, 27n, 20n, 15n, 11n, 8n, 6n, 4n, 3n, 2n, 2n, 1n, 1n, 0n, 0n, 0n, 0n, 0n,
    0n, 0n, 0n, 0n, 0n, 0n, 0n,
]);

export function turnsForFullRegenInThousandths(bonus: Fixpt): number {
    const idx = clamp(Number(bonus / FP_FACTOR + 10n), 0, lastIndex(POW_REGEN));
    return Number(1000n * BigInt(TURNS_FOR_FULL_REGEN) * POW_REGEN[idx] / FP_FACTOR) + 2000;
}

// =============================================================================
// Damage Fraction
// =============================================================================

const POW_DAMAGE_FRACTION: readonly Fixpt[] = Object.freeze([
    // 1.065^x fixed point, with x representing a change in 0.25 weapon enchantment points, ranging from -20 to 50.
    18598n, 18894n, 19193n, 19498n, 19807n, 20122n, 20441n, 20765n, 21095n, 21430n, 21770n,
    22115n, 22466n, 22823n, 23185n, 23553n, 23926n, 24306n, 24692n, 25084n, 25482n, 25886n,
    26297n, 26714n, 27138n, 27569n, 28006n, 28451n, 28902n, 29361n, 29827n, 30300n, 30781n,
    31269n, 31765n, 32269n, 32781n, 33302n, 33830n, 34367n, 34912n, 35466n, 36029n, 36601n,
    37182n, 37772n, 38371n, 38980n, 39598n, 40227n, 40865n, 41514n, 42172n, 42842n, 43521n,
    44212n, 44914n, 45626n, 46350n, 47086n, 47833n, 48592n, 49363n, 50146n, 50942n, 51751n,
    52572n, 53406n, 54253n, 55114n, 55989n, 56877n, 57780n, 58697n, 59628n, 60574n, 61536n,
    62512n, 63504n, 64512n, 65536n, 66575n, 67632n, 68705n, 69795n, 70903n, 72028n, 73171n,
    74332n, 75512n, 76710n, 77927n, 79164n, 80420n, 81696n, 82992n, 84309n, 85647n, 87006n,
    88387n, 89789n, 91214n, 92662n, 94132n, 95626n, 97143n, 98685n, 100251n, 101842n, 103458n,
    105099n, 106767n, 108461n, 110182n, 111931n, 113707n, 115511n, 117344n, 119206n, 121098n,
    123020n, 124972n, 126955n, 128969n, 131016n, 133095n, 135207n, 137352n, 139532n, 141746n,
    143995n, 146280n, 148602n, 150960n, 153355n, 155789n, 158261n, 160772n, 163323n, 165915n,
    168548n, 171222n, 173939n, 176699n, 179503n, 182352n, 185245n, 188185n, 191171n, 194205n,
    197286n, 200417n, 203597n, 206828n, 210110n, 213444n, 216831n, 220272n, 223767n, 227318n,
    230925n, 234589n, 238312n, 242094n, 245935n, 249838n, 253802n, 257830n, 261921n, 266077n,
    270300n, 274589n, 278946n, 283372n, 287869n, 292437n, 297078n, 301792n, 306581n, 311445n,
    316388n, 321408n, 326508n, 331689n, 336953n, 342300n, 347731n, 353249n, 358855n, 364549n,
    370334n, 376211n, 382180n, 388245n, 394406n, 400664n, 407022n, 413481n, 420042n, 426707n,
    433479n, 440357n, 447345n, 454443n, 461655n, 468980n, 476422n, 483982n, 491662n, 499464n,
    507390n, 515441n, 523620n, 531929n, 540370n, 548945n, 557656n, 566505n, 575494n, 584626n,
    593903n, 603328n, 612901n, 622627n, 632507n, 642544n, 652740n, 663098n, 673620n, 684309n,
    695168n, 706199n, 717406n, 728790n, 740354n, 752102n, 764037n, 776161n, 788477n, 800989n,
    813699n, 826611n, 839728n, 853053n, 866590n, 880341n, 894311n, 908502n, 922918n, 937563n,
    952441n, 967555n, 982908n, 998505n, 1014350n, 1030446n, 1046797n, 1063408n, 1080282n,
    1097425n, 1114839n, 1132529n, 1150501n, 1168757n, 1187303n, 1206144n, 1225283n, 1244726n,
    1264478n, 1284543n, 1304927n, 1325634n, 1346669n, 1368039n, 1389747n, 1411800n, 1434203n,
    1456961n, 1480081n, 1503567n, 1527426n,
]);

export function damageFraction(netEnchant: Fixpt): Fixpt {
    const idx = clamp(Number(netEnchant * 4n / FP_FACTOR + 80n), 0, lastIndex(POW_DAMAGE_FRACTION));
    return POW_DAMAGE_FRACTION[idx];
}

// =============================================================================
// Accuracy Fraction (same table as damage fraction)
// =============================================================================

const POW_ACCURACY_FRACTION: readonly Fixpt[] = POW_DAMAGE_FRACTION;

export function accuracyFraction(netEnchant: Fixpt): Fixpt {
    const idx = clamp(Number(netEnchant * 4n / FP_FACTOR + 80n), 0, lastIndex(POW_ACCURACY_FRACTION));
    return POW_ACCURACY_FRACTION[idx];
}

// =============================================================================
// Defense Fraction
// =============================================================================

const POW_DEFENSE_FRACTION: readonly Fixpt[] = Object.freeze([
    // 0.877347265^x fixed point, ranging from -20 to 50.
    897530n, 868644n, 840688n, 813632n, 787446n, 762103n, 737575n, 713837n, 690863n, 668629n,
    647110n, 626283n, 606127n, 586619n, 567740n, 549468n, 531784n, 514669n, 498105n, 482074n,
    466559n, 451543n, 437011n, 422946n, 409334n, 396160n, 383410n, 371071n, 359128n, 347570n,
    336384n, 325558n, 315080n, 304940n, 295125n, 285627n, 276435n, 267538n, 258927n, 250594n,
    242529n, 234724n, 227169n, 219858n, 212782n, 205934n, 199306n, 192892n, 186684n, 180676n,
    174861n, 169233n, 163786n, 158515n, 153414n, 148476n, 143698n, 139073n, 134597n, 130265n,
    126073n, 122015n, 118088n, 114288n, 110609n, 107050n, 103604n, 100270n, 97043n, 93920n,
    90897n, 87971n, 85140n, 82400n, 79748n, 77181n, 74697n, 72293n, 69967n, 67715n, 65536n,
    63426n, 61385n, 59409n, 57497n, 55647n, 53856n, 52123n, 50445n, 48822n, 47250n, 45730n,
    44258n, 42833n, 41455n, 40121n, 38829n, 37580n, 36370n, 35200n, 34067n, 32970n, 31909n,
    30882n, 29888n, 28926n, 27995n, 27094n, 26222n, 25378n, 24562n, 23771n, 23006n, 22266n,
    21549n, 20855n, 20184n, 19535n, 18906n, 18297n, 17709n, 17139n, 16587n, 16053n, 15536n,
    15036n, 14552n, 14084n, 13631n, 13192n, 12768n, 12357n, 11959n, 11574n, 11201n, 10841n,
    10492n, 10154n, 9828n, 9511n, 9205n, 8909n, 8622n, 8345n, 8076n, 7816n, 7565n, 7321n,
    7085n, 6857n, 6637n, 6423n, 6216n, 6016n, 5823n, 5635n, 5454n, 5278n, 5108n, 4944n,
    4785n, 4631n, 4482n, 4337n, 4198n, 4063n, 3932n, 3805n, 3683n, 3564n, 3450n, 3339n,
    3231n, 3127n, 3026n, 2929n, 2835n, 2744n, 2655n, 2570n, 2487n, 2407n, 2329n, 2255n,
    2182n, 2112n, 2044n, 1978n, 1914n, 1853n, 1793n, 1735n, 1679n, 1625n, 1573n, 1522n,
    1473n, 1426n, 1380n, 1336n, 1293n, 1251n, 1211n, 1172n, 1134n, 1097n, 1062n, 1028n,
    995n, 963n, 932n, 902n, 873n, 845n, 817n, 791n, 766n, 741n, 717n, 694n, 672n, 650n,
    629n, 609n, 589n, 570n, 552n, 534n, 517n, 500n, 484n, 469n, 453n, 439n, 425n, 411n,
    398n, 385n, 373n, 361n, 349n, 338n, 327n, 316n, 306n, 296n, 287n, 277n, 268n, 260n,
    251n, 243n, 235n, 228n, 221n, 213n, 207n, 200n, 193n, 187n, 181n, 175n, 170n, 164n,
    159n, 154n, 149n, 144n, 139n, 135n, 130n, 126n, 122n, 118n, 114n, 111n, 107n, 104n,
    100n, 97n, 94n,
]);

export function defenseFraction(netDefense: Fixpt): Fixpt {
    const idx = clamp(Number(netDefense * 4n / 10n / FP_FACTOR + 80n), 0, lastIndex(POW_DEFENSE_FRACTION));
    return POW_DEFENSE_FRACTION[idx];
}

// =============================================================================
// Charm Protection
// =============================================================================

const POW_CHARM_PROTECTION: readonly Fixpt[] = Object.freeze([
    // 1.35^x fixed point, with x from 0 to 50 in increments of 1:
    65536n, 88473n, 119439n, 161243n, 217678n, 293865n, 396718n, 535570n, 723019n, 976076n,
    1317703n, 1778899n, 2401514n, 3242044n, 4376759n, 5908625n, 7976644n, 10768469n, 14537434n,
    19625536n, 26494473n, 35767539n, 48286178n, 65186341n, 88001560n, 118802106n, 160382844n,
    216516839n, 292297733n, 394601940n, 532712620n, 719162037n, 970868750n, 1310672812n,
    1769408297n, 2388701201n, 3224746621n, 4353407939n, 5877100717n, 7934085969n, 10711016058n,
    14459871678n, 19520826766n, 26353116134n, 35576706781n, 48028554155n, 64838548109n,
    87532039948n, 118168253930n, 159527142806n, 215361642788n,
]);

/**
 * Charm protection. Note: `enchant` here is the raw enchantment level (not multiplied by FP_FACTOR).
 * The charmEffectTable[CHARM_PROTECTION].effectMagnitudeMultiplier needs to be provided.
 */
export function charmProtection(enchant: Fixpt, effectMagnitudeMultiplier: number): number {
    const idx = clamp(Number(enchant / FP_FACTOR - 1n), 0, lastIndex(POW_CHARM_PROTECTION));
    return Number(BigInt(effectMagnitudeMultiplier) * POW_CHARM_PROTECTION[idx] / FP_FACTOR);
}

// =============================================================================
// Runic Weapon Chance lookup tables
// =============================================================================

const POW_16_RUNIC_DECREMENT: readonly Fixpt[] = Object.freeze([
    // (1-0.16)^x, x from 0 to 50 in increments of 0.25:
    65536n, 62740n, 60064n, 57502n, 55050n, 52702n, 50454n, 48302n, 46242n, 44269n, 42381n,
    40574n, 38843n, 37186n, 35600n, 34082n, 32628n, 31236n, 29904n, 28629n, 27407n, 26238n,
    25119n, 24048n, 23022n, 22040n, 21100n, 20200n, 19339n, 18514n, 17724n, 16968n, 16244n,
    15551n, 14888n, 14253n, 13645n, 13063n, 12506n, 11972n, 11462n, 10973n, 10505n, 10057n,
    9628n, 9217n, 8824n, 8448n, 8087n, 7742n, 7412n, 7096n, 6793n, 6503n, 6226n, 5961n,
    5706n, 5463n, 5230n, 5007n, 4793n, 4589n, 4393n, 4206n, 4026n, 3854n, 3690n, 3533n,
    3382n, 3238n, 3100n, 2967n, 2841n, 2720n, 2604n, 2492n, 2386n, 2284n, 2187n, 2094n,
    2004n, 1919n, 1837n, 1759n, 1684n, 1612n, 1543n, 1477n, 1414n, 1354n, 1296n, 1241n,
    1188n, 1137n, 1089n, 1042n, 998n, 955n, 914n, 875n, 838n, 802n, 768n, 735n, 704n,
    674n, 645n, 617n, 591n, 566n, 542n, 519n, 496n, 475n, 455n, 436n, 417n, 399n, 382n,
    366n, 350n, 335n, 321n, 307n, 294n, 281n, 269n, 258n, 247n, 236n, 226n, 217n, 207n,
    198n, 190n, 182n, 174n, 167n, 159n, 153n, 146n, 140n, 134n, 128n, 123n, 117n, 112n,
    108n, 103n, 99n, 94n, 90n, 86n, 83n, 79n, 76n, 73n, 69n, 66n, 64n, 61n, 58n, 56n,
    53n, 51n, 49n, 47n, 45n, 43n, 41n, 39n, 37n, 36n, 34n, 33n, 31n, 30n, 29n, 27n, 26n,
    25n, 24n, 23n, 22n, 21n, 20n, 19n, 18n, 18n, 17n, 16n, 15n, 15n, 14n, 13n, 13n, 12n,
    12n, 11n, 11n, 10n,
]);

const POW_15_RUNIC_DECREMENT: readonly Fixpt[] = Object.freeze([
    // (1-0.15)^x, x from 0 to 50 in increments of 0.25:
    65536n, 62926n, 60421n, 58015n, 55705n, 53487n, 51358n, 49313n, 47349n, 45464n, 43654n,
    41916n, 40247n, 38644n, 37106n, 35628n, 34210n, 32848n, 31540n, 30284n, 29078n, 27920n,
    26809n, 25741n, 24716n, 23732n, 22787n, 21880n, 21009n, 20172n, 19369n, 18598n, 17857n,
    17146n, 16464n, 15808n, 15179n, 14574n, 13994n, 13437n, 12902n, 12388n, 11895n, 11421n,
    10967n, 10530n, 10111n, 9708n, 9321n, 8950n, 8594n, 8252n, 7923n, 7608n, 7305n, 7014n,
    6735n, 6466n, 6209n, 5962n, 5724n, 5496n, 5278n, 5067n, 4866n, 4672n, 4486n, 4307n,
    4136n, 3971n, 3813n, 3661n, 3515n, 3375n, 3241n, 3112n, 2988n, 2869n, 2755n, 2645n,
    2540n, 2439n, 2341n, 2248n, 2159n, 2073n, 1990n, 1911n, 1835n, 1762n, 1692n, 1624n,
    1559n, 1497n, 1438n, 1380n, 1325n, 1273n, 1222n, 1173n, 1127n, 1082n, 1039n, 997n,
    958n, 919n, 883n, 848n, 814n, 781n, 750n, 720n, 692n, 664n, 638n, 612n, 588n, 564n,
    542n, 520n, 500n, 480n, 461n, 442n, 425n, 408n, 391n, 376n, 361n, 346n, 333n, 319n,
    307n, 294n, 283n, 271n, 261n, 250n, 240n, 231n, 221n, 213n, 204n, 196n, 188n, 181n,
    173n, 166n, 160n, 153n, 147n, 141n, 136n, 130n, 125n, 120n, 115n, 111n, 106n, 102n,
    98n, 94n, 90n, 87n, 83n, 80n, 77n, 74n, 71n, 68n, 65n, 62n, 60n, 58n, 55n, 53n, 51n,
    49n, 47n, 45n, 43n, 41n, 40n, 38n, 37n, 35n, 34n, 32n, 31n, 30n, 29n, 27n, 26n, 25n,
    24n, 23n, 22n, 21n, 21n, 20n, 19n,
]);

const POW_14_RUNIC_DECREMENT: readonly Fixpt[] = Object.freeze([
    // (1-0.14)^x, x from 0 to 50 in increments of 0.25:
    65536n, 63110n, 60775n, 58526n, 56360n, 54275n, 52267n, 50332n, 48470n, 46676n, 44949n,
    43286n, 41684n, 40142n, 38656n, 37226n, 35848n, 34522n, 33244n, 32014n, 30829n, 29689n,
    28590n, 27532n, 26513n, 25532n, 24587n, 23677n, 22801n, 21958n, 21145n, 20363n, 19609n,
    18883n, 18185n, 17512n, 16864n, 16240n, 15639n, 15060n, 14503n, 13966n, 13449n, 12952n,
    12472n, 12011n, 11566n, 11138n, 10726n, 10329n, 9947n, 9579n, 9224n, 8883n, 8554n,
    8238n, 7933n, 7639n, 7357n, 7084n, 6822n, 6570n, 6327n, 6092n, 5867n, 5650n, 5441n,
    5239n, 5046n, 4859n, 4679n, 4506n, 4339n, 4179n, 4024n, 3875n, 3732n, 3593n, 3460n,
    3332n, 3209n, 3090n, 2976n, 2866n, 2760n, 2658n, 2559n, 2465n, 2373n, 2285n, 2201n,
    2119n, 2041n, 1965n, 1893n, 1823n, 1755n, 1690n, 1628n, 1567n, 1509n, 1454n, 1400n,
    1348n, 1298n, 1250n, 1204n, 1159n, 1116n, 1075n, 1035n, 997n, 960n, 924n, 890n, 857n,
    825n, 795n, 765n, 737n, 710n, 684n, 658n, 634n, 610n, 588n, 566n, 545n, 525n, 505n,
    487n, 469n, 451n, 435n, 418n, 403n, 388n, 374n, 360n, 346n, 334n, 321n, 309n, 298n,
    287n, 276n, 266n, 256n, 247n, 237n, 229n, 220n, 212n, 204n, 197n, 189n, 182n, 176n,
    169n, 163n, 157n, 151n, 145n, 140n, 135n, 130n, 125n, 120n, 116n, 111n, 107n, 103n,
    99n, 96n, 92n, 89n, 85n, 82n, 79n, 76n, 73n, 71n, 68n, 66n, 63n, 61n, 58n, 56n, 54n,
    52n, 50n, 48n, 47n, 45n, 43n, 42n, 40n, 38n, 37n, 36n, 34n,
]);

const POW_11_RUNIC_DECREMENT: readonly Fixpt[] = Object.freeze([
    // (1-0.11)^x, x from 0 to 50 in increments of 0.25:
    65536n, 63654n, 61826n, 60051n, 58327n, 56652n, 55025n, 53445n, 51911n, 50420n, 48972n,
    47566n, 46200n, 44874n, 43585n, 42334n, 41118n, 39938n, 38791n, 37677n, 36595n, 35544n,
    34524n, 33533n, 32570n, 31634n, 30726n, 29844n, 28987n, 28155n, 27346n, 26561n, 25798n,
    25058n, 24338n, 23639n, 22960n, 22301n, 21661n, 21039n, 20435n, 19848n, 19278n, 18725n,
    18187n, 17665n, 17157n, 16665n, 16186n, 15721n, 15270n, 14832n, 14406n, 13992n, 13590n,
    13200n, 12821n, 12453n, 12095n, 11748n, 11411n, 11083n, 10765n, 10456n, 10155n, 9864n,
    9581n, 9305n, 9038n, 8779n, 8527n, 8282n, 8044n, 7813n, 7589n, 7371n, 7159n, 6954n,
    6754n, 6560n, 6372n, 6189n, 6011n, 5838n, 5671n, 5508n, 5350n, 5196n, 5047n, 4902n,
    4761n, 4624n, 4492n, 4363n, 4237n, 4116n, 3997n, 3883n, 3771n, 3663n, 3558n, 3456n,
    3356n, 3260n, 3166n, 3075n, 2987n, 2901n, 2818n, 2737n, 2658n, 2582n, 2508n, 2436n,
    2366n, 2298n, 2232n, 2168n, 2106n, 2045n, 1986n, 1929n, 1874n, 1820n, 1768n, 1717n,
    1668n, 1620n, 1573n, 1528n, 1484n, 1442n, 1400n, 1360n, 1321n, 1283n, 1246n, 1210n,
    1176n, 1142n, 1109n, 1077n, 1046n, 1016n, 987n, 959n, 931n, 904n, 878n, 853n, 829n,
    805n, 782n, 759n, 737n, 716n, 696n, 676n, 656n, 637n, 619n, 601n, 584n, 567n, 551n,
    535n, 520n, 505n, 490n, 476n, 462n, 449n, 436n, 424n, 412n, 400n, 388n, 377n, 366n,
    356n, 345n, 336n, 326n, 317n, 307n, 299n, 290n, 282n, 274n, 266n, 258n, 251n, 243n,
    236n, 230n, 223n, 217n, 210n, 204n, 198n, 193n,
]);

const POW_7_RUNIC_DECREMENT: readonly Fixpt[] = Object.freeze([
    // (1-0.07)^x, x from 0 to 50 in increments of 0.25:
    65536n, 64357n, 63200n, 62064n, 60948n, 59852n, 58776n, 57719n, 56682n, 55662n, 54662n,
    53679n, 52714n, 51766n, 50835n, 49921n, 49024n, 48142n, 47277n, 46427n, 45592n, 44772n,
    43967n, 43177n, 42401n, 41638n, 40890n, 40155n, 39433n, 38724n, 38027n, 37344n, 36672n,
    36013n, 35365n, 34730n, 34105n, 33492n, 32890n, 32298n, 31718n, 31147n, 30587n, 30038n,
    29497n, 28967n, 28446n, 27935n, 27433n, 26939n, 26455n, 25979n, 25512n, 25054n, 24603n,
    24161n, 23726n, 23300n, 22881n, 22470n, 22066n, 21669n, 21279n, 20897n, 20521n, 20152n,
    19790n, 19434n, 19084n, 18741n, 18404n, 18073n, 17748n, 17429n, 17116n, 16808n, 16506n,
    16209n, 15918n, 15632n, 15351n, 15075n, 14804n, 14537n, 14276n, 14019n, 13767n, 13520n,
    13277n, 13038n, 12804n, 12573n, 12347n, 12125n, 11907n, 11693n, 11483n, 11276n, 11074n,
    10875n, 10679n, 10487n, 10299n, 10113n, 9931n, 9753n, 9578n, 9405n, 9236n, 9070n,
    8907n, 8747n, 8590n, 8435n, 8284n, 8135n, 7988n, 7845n, 7704n, 7565n, 7429n, 7296n,
    7164n, 7036n, 6909n, 6785n, 6663n, 6543n, 6425n, 6310n, 6196n, 6085n, 5976n, 5868n,
    5763n, 5659n, 5557n, 5457n, 5359n, 5263n, 5168n, 5075n, 4984n, 4894n, 4806n, 4720n,
    4635n, 4552n, 4470n, 4390n, 4311n, 4233n, 4157n, 4082n, 4009n, 3937n, 3866n, 3796n,
    3728n, 3661n, 3595n, 3531n, 3467n, 3405n, 3344n, 3283n, 3224n, 3166n, 3110n, 3054n,
    2999n, 2945n, 2892n, 2840n, 2789n, 2739n, 2689n, 2641n, 2594n, 2547n, 2501n, 2456n,
    2412n, 2369n, 2326n, 2284n, 2243n, 2203n, 2163n, 2124n, 2086n, 2048n, 2012n, 1975n,
    1940n, 1905n, 1871n, 1837n, 1804n, 1772n, 1740n,
]);

const POW_6_RUNIC_DECREMENT: readonly Fixpt[] = Object.freeze([
    // (1-0.06)^x, x from 0 to 50 in increments of 0.25:
    65536n, 64530n, 63539n, 62564n, 61603n, 60658n, 59727n, 58810n, 57907n, 57018n, 56143n,
    55281n, 54433n, 53597n, 52774n, 51964n, 51167n, 50381n, 49608n, 48846n, 48097n, 47358n,
    46631n, 45916n, 45211n, 44517n, 43833n, 43161n, 42498n, 41846n, 41203n, 40571n, 39948n,
    39335n, 38731n, 38137n, 37551n, 36975n, 36407n, 35848n, 35298n, 34756n, 34223n, 33698n,
    33180n, 32671n, 32169n, 31676n, 31189n, 30711n, 30239n, 29775n, 29318n, 28868n, 28425n,
    27989n, 27559n, 27136n, 26719n, 26309n, 25905n, 25508n, 25116n, 24731n, 24351n, 23977n,
    23609n, 23247n, 22890n, 22539n, 22193n, 21852n, 21516n, 21186n, 20861n, 20541n, 20225n,
    19915n, 19609n, 19308n, 19012n, 18720n, 18433n, 18150n, 17871n, 17597n, 17327n, 17061n,
    16799n, 16541n, 16287n, 16037n, 15791n, 15549n, 15310n, 15075n, 14843n, 14616n, 14391n,
    14170n, 13953n, 13739n, 13528n, 13320n, 13116n, 12914n, 12716n, 12521n, 12329n, 12139n,
    11953n, 11770n, 11589n, 11411n, 11236n, 11063n, 10894n, 10726n, 10562n, 10400n, 10240n,
    10083n, 9928n, 9776n, 9625n, 9478n, 9332n, 9189n, 9048n, 8909n, 8772n, 8638n, 8505n,
    8374n, 8246n, 8119n, 7995n, 7872n, 7751n, 7632n, 7515n, 7400n, 7286n, 7174n, 7064n,
    6956n, 6849n, 6744n, 6640n, 6538n, 6438n, 6339n, 6242n, 6146n, 6052n, 5959n, 5867n,
    5777n, 5688n, 5601n, 5515n, 5430n, 5347n, 5265n, 5184n, 5105n, 5026n, 4949n, 4873n,
    4798n, 4725n, 4652n, 4581n, 4510n, 4441n, 4373n, 4306n, 4240n, 4175n, 4111n, 4047n,
    3985n, 3924n, 3864n, 3805n, 3746n, 3689n, 3632n, 3576n, 3521n, 3467n, 3414n, 3362n,
    3310n, 3259n, 3209n, 3160n, 3111n, 3064n, 3017n, 2970n,
]);

/**
 * The runic weapon chance lookup tables, indexed by weapon runic kind.
 * Null entries are for runic types that don't use this system (slaying, mercy, plenty).
 */
export const RUNIC_EFFECT_CHANCE_TABLES: readonly (readonly Fixpt[] | null)[] = Object.freeze([
    POW_16_RUNIC_DECREMENT, // W_SPEED
    POW_6_RUNIC_DECREMENT,  // W_QUIETUS
    POW_7_RUNIC_DECREMENT,  // W_PARALYSIS
    POW_15_RUNIC_DECREMENT, // W_MULTIPLICITY
    POW_14_RUNIC_DECREMENT, // W_SLOWING
    POW_11_RUNIC_DECREMENT, // W_CONFUSION
    POW_15_RUNIC_DECREMENT, // W_FORCE
    null,                    // W_SLAYING
    null,                    // W_MERCY
    null,                    // W_PLENTY
]);

/**
 * Get the last valid index of the POW_16 runic decrement table.
 * Used to clamp table lookups.
 */
export const RUNIC_TABLE_LAST_INDEX = lastIndex(POW_16_RUNIC_DECREMENT);

// =============================================================================
// Charm Functions
// =============================================================================

/**
 * Charm healing amount (clamped to 0–100 percent).
 * charmEffectTable[CHARM_HEALTH].effectMagnitudeMultiplier * enchant / FP_FACTOR
 */
export function charmHealing(enchant: Fixpt, effectMagnitudeMultiplier: number): number {
    return clamp(Math.floor(effectMagnitudeMultiplier * Number(enchant) / Number(FP_FACTOR)), 0, 100);
}

/**
 * Charm shattering: constant + enchant level.
 */
export function charmShattering(enchant: Fixpt, effectMagnitudeConstant: number): number {
    return effectMagnitudeConstant + Number(enchant / FP_FACTOR);
}

/**
 * Charm guardian lifespan: constant + multiplier * enchant level.
 */
export function charmGuardianLifespan(enchant: Fixpt, effectMagnitudeConstant: number, effectMagnitudeMultiplier: number): number {
    return effectMagnitudeConstant + effectMagnitudeMultiplier * Number(enchant / FP_FACTOR);
}

/**
 * Charm negation radius: constant + multiplier * enchant level.
 */
export function charmNegationRadius(enchant: Fixpt, effectMagnitudeConstant: number, effectMagnitudeMultiplier: number): number {
    return effectMagnitudeConstant + effectMagnitudeMultiplier * Number(enchant / FP_FACTOR);
}

/**
 * Charm effect duration, using the charmEffectTable lookup.
 */
export function charmEffectDuration(entry: CharmEffectTableEntry, enchant: number): number {
    const idx = clamp(enchant - 1, 0, CHARM_EFFECT_DURATION_INCREMENT_ARRAY_SIZE - 1);
    return Number(BigInt(entry.effectDurationBase) * entry.effectDurationIncrement[idx] / FP_FACTOR);
}

/**
 * Charm recharge delay: effect duration + decay curve.
 */
export function charmRechargeDelay(entry: CharmEffectTableEntry, enchant: number): number {
    const e = clamp(enchant, 1, 50);
    const delay = charmEffectDuration(entry, e)
        + Number(BigInt(entry.rechargeDelayDuration) * fpPow(BigInt(entry.rechargeDelayBase) * FP_FACTOR / 100n, e) / FP_FACTOR);
    return Math.max(entry.rechargeDelayMinTurns, delay);
}

// =============================================================================
// Wand Dominate
// =============================================================================

/**
 * Wand dominate chance based on current vs. max HP.
 * Returns 100 if currentHP * 5 < maxHP, otherwise scales 0..100.
 */
export function wandDominate(currentHP: number, maxHP: number): number {
    if (currentHP * 5 < maxHP) return 100;
    return Math.max(0, Math.floor(100 * (maxHP - currentHP) / maxHP));
}

// =============================================================================
// Runic Weapon Chance
// =============================================================================

/**
 * Calculate the chance (0-100) that a weapon runic will activate.
 *
 * @param runicType The weapon runic kind (enum index)
 * @param enchantLevel The net enchantment level (as Fixpt)
 * @param adjustedBaseDamage The average base damage of the weapon (before enchantment)
 * @param attacksStagger Whether the weapon attacks every other turn
 * @param attacksQuickly Whether the weapon attacks twice per turn
 */
export function runicWeaponChance(
    runicType: number,
    enchantLevel: Fixpt,
    adjustedBaseDamage: number,
    attacksStagger: boolean,
    attacksQuickly: boolean,
): number {
    // Slaying always returns 0
    // W_SLAYING = 7 in the enum
    if (runicType === 7) {
        return 0;
    }

    // Bad runics always return 15
    if (runicType >= NUMBER_GOOD_WEAPON_ENCHANT_KINDS) {
        return 15;
    }

    const effectChances = RUNIC_EFFECT_CHANCE_TABLES;

    // Adjust base damage for stagger
    let adjDamage = adjustedBaseDamage;
    if (attacksStagger) {
        adjDamage = Math.floor(adjDamage / 2);
    }

    const modifier = FP_FACTOR - (
        (99n * FP_FACTOR / 100n) < (BigInt(adjDamage) * FP_FACTOR / 18n)
            ? 99n * FP_FACTOR / 100n
            : BigInt(adjDamage) * FP_FACTOR / 18n
    );

    let chance: number;

    if (enchantLevel < 0n) {
        chance = 0;
    } else {
        let tableIndex = Number(enchantLevel * modifier * 4n / FP_FACTOR / FP_FACTOR);
        tableIndex = clamp(tableIndex, 0, RUNIC_TABLE_LAST_INDEX);
        const table = effectChances[runicType];
        if (!table) return 0;
        chance = 100 - Number(100n * table[tableIndex] / FP_FACTOR);
    }

    // Slow weapons get adjusted chance: 1 - (1-p)^2
    if (attacksStagger) {
        chance = 100 - Math.floor((100 - chance) * (100 - chance) / 100);
    }

    // Fast weapons get adjusted chance: 1 - sqrt(1-p)
    if (attacksQuickly) {
        chance = Number(100n * (FP_FACTOR - fpSqrt(FP_FACTOR - BigInt(chance) * FP_FACTOR / 100n)) / FP_FACTOR);
    }

    // Minimum chance is the enchantment level (if > 0), always at least 1
    const minChance = Math.max(1, Number(enchantLevel / FP_FACTOR));
    chance = clamp(chance, minChance, 100);

    return chance;
}
