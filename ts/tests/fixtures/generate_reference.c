/*
 *  generate_reference.c — Generate reference RNG/fixpt values from the C code
 *
 *  Compile with:
 *    cc -o generate_reference generate_reference.c -I../../src/brogue
 *
 *  Run:
 *    ./generate_reference > reference_values.json
 *
 *  This standalone program re-implements the core RNG and fixpt routines
 *  from Math.c so it can be compiled without the full Brogue codebase.
 */

#include <stdio.h>
#include <stdint.h>

/* ----- RNG (from Math.c) ----- */

typedef uint32_t u4;
typedef struct ranctx { u4 a; u4 b; u4 c; u4 d; } ranctx;

static ranctx RNGState[2];

#define rot(x,k) (((x)<<(k))|((x)>>(32-(k))))

static u4 ranval(ranctx *x) {
    u4 e = x->a - rot(x->b, 27);
    x->a = x->b ^ rot(x->c, 17);
    x->b = x->c + x->d;
    x->c = x->d + e;
    x->d = e + x->a;
    return x->d;
}

static void raninit(ranctx *x, uint64_t seed) {
    u4 i;
    x->a = 0xf1ea5eed, x->b = x->c = x->d = (u4)seed;
    x->c ^= (u4)(seed >> 32);
    for (i = 0; i < 20; ++i) {
        (void)ranval(x);
    }
}

#define RAND_MAX_COMBO ((unsigned long) UINT32_MAX)

static long range_fn(long n, short rng) {
    unsigned long div;
    long r;
    div = RAND_MAX_COMBO / n;
    do {
        r = ranval(&(RNGState[rng])) / div;
    } while (r >= n);
    return r;
}

static long rand_range(long lowerBound, long upperBound, short rng) {
    if (upperBound <= lowerBound) return lowerBound;
    long interval = upperBound - lowerBound + 1;
    return lowerBound + range_fn(interval, rng);
}

static uint64_t seedRandomGenerator(uint64_t seed) {
    if (seed == 0) return 0;
    raninit(&(RNGState[0]), seed);
    raninit(&(RNGState[1]), seed);
    return seed;
}

/* ----- Fixed-point (from Math.c) ----- */

typedef long long fixpt;
#define FP_BASE 16
#define FP_FACTOR (1LL << FP_BASE)
#define FP_MUL(x, y) ((x) * (y) / FP_FACTOR)
#define FP_DIV(x, y) ((x) * FP_FACTOR / (y))

fixpt fp_round(fixpt x) {
    long long div = x / FP_FACTOR, rem = x % FP_FACTOR;
    int sign = (x >= 0) - (x < 0);
    if (rem >= FP_FACTOR / 2 || rem <= -FP_FACTOR / 2) {
        return div + sign;
    } else {
        return div;
    }
}

static int msbpos(unsigned long long x) {
    if (x == 0) return 0;
    int n = 0;
    do { n += 1; } while (x >>= 1);
    return n;
}

static fixpt fp_exp2(int n) {
    return (n >= 0 ? FP_FACTOR << n : FP_FACTOR >> -n);
}

fixpt fp_sqrt(fixpt u) {
    static const fixpt SQUARE_ROOTS[] = {
        0, 65536, 92682, 113511, 131073, 146543, 160529, 173392,
        185363, 196608, 207243, 217359, 227023, 236293, 245213, 253819,
        262145, 270211, 278045, 285665, 293086, 300323, 307391, 314299,
        321059, 327680, 334169, 340535, 346784, 352923, 358955, 364889,
        370727, 376475, 382137, 387717, 393216, 398640, 403991, 409273,
        414487, 419635, 424721, 429749, 434717, 439629, 444487, 449293,
        454047, 458752, 463409, 468021, 472587, 477109, 481589, 486028,
        490427, 494786, 499107, 503391, 507639, 511853, 516031, 520175,
        524289, 528369, 532417, 536435, 540423, 544383, 548313, 552217,
        556091, 559939, 563762, 567559, 571329, 575077, 578799, 582497,
        586171, 589824, 593453, 597061, 600647, 604213, 607755, 611279,
        614783, 618265, 621729, 625173, 628599, 632007, 635395, 638765,
        642119, 645455, 648773, 652075, 655360, 658629, 661881, 665117,
        668339, 671545, 674735, 677909, 681071, 684215, 687347, 690465,
        693567, 696657, 699733, 702795, 705845, 708881, 711903, 714913,
        717911, 720896, 723869, 726829, 729779, 732715, 735639, 738553
    };

    if (u < 0) return -fp_sqrt(-u);
    if ((u & (127LL << FP_BASE)) == u) {
        return SQUARE_ROOTS[u >> FP_BASE];
    }

    int k = msbpos(u) - FP_BASE;
    fixpt x = 0, fx, upper, lower;
    upper = fp_exp2((k + (k > 0)) / 2);
    lower = upper / 2;

    while (upper != lower + 1) {
        x = (upper + lower) / 2;
        fx = FP_MUL(x, x) - u;
        if (fx == 0) break;
        else if (fx > 0) upper = x;
        else lower = x;
    }
    return x;
}

fixpt fp_pow(fixpt base, int expn) {
    if (base == 0) return 0;
    if (expn < 0) {
        base = FP_DIV(FP_FACTOR, base);
        expn = -expn;
    }
    fixpt res = FP_FACTOR, err = 0;
    while (expn--) {
        res = res * base + (err * base) / FP_FACTOR;
        err = res % FP_FACTOR;
        res /= FP_FACTOR;
    }
    return res + fp_round(err);
}

int main(void) {
    /* Generate reference RNG values */
    printf("{\n");
    printf("  \"rng\": {\n");

    /* seed 12345, first 20 rand_range(0, 999) */
    seedRandomGenerator(12345);
    printf("    \"seed_12345_range_0_999\": [");
    for (int i = 0; i < 20; i++) {
        if (i > 0) printf(", ");
        printf("%ld", rand_range(0, 999, 0));
    }
    printf("],\n");

    /* seed 42, first 20 rand_range(0, 999) */
    seedRandomGenerator(42);
    printf("    \"seed_42_range_0_999\": [");
    for (int i = 0; i < 20; i++) {
        if (i > 0) printf(", ");
        printf("%ld", rand_range(0, 999, 0));
    }
    printf("],\n");

    /* seed 1, first 20 rand_range(0, 99) */
    seedRandomGenerator(1);
    printf("    \"seed_1_range_0_99\": [");
    for (int i = 0; i < 20; i++) {
        if (i > 0) printf(", ");
        printf("%ld", rand_range(0, 99, 0));
    }
    printf("],\n");

    /* seed 1, first 20 rand_range(0, 999) */
    seedRandomGenerator(1);
    printf("    \"seed_1_range_0_999\": [");
    for (int i = 0; i < 20; i++) {
        if (i > 0) printf(", ");
        printf("%ld", rand_range(0, 999, 0));
    }
    printf("],\n");

    /* seed 1, backward-compatible level seeds (lo + hi*10000) */
    seedRandomGenerator(1);
    printf("    \"seed_1_level_seeds\": [");
    for (int i = 0; i < 10; i++) {
        long lo = rand_range(0, 9999, 0);
        long hi = rand_range(0, 9999, 0);
        if (i > 0) printf(", ");
        printf("%ld", lo + hi * 10000);
    }
    printf("]\n");

    printf("  },\n");

    /* Generate reference fixpt values */
    printf("  \"fixpt\": {\n");
    printf("    \"sqrt\": {\n");
    for (int i = 0; i <= 127; i++) {
        fixpt v = (fixpt)i << FP_BASE;
        printf("      \"%d\": %lld%s\n", i, fp_sqrt(v), i < 127 ? "," : "");
    }
    printf("    },\n");

    printf("    \"pow_2\": {\n");
    fixpt two = 2 * FP_FACTOR;
    for (int e = -5; e <= 10; e++) {
        printf("      \"%d\": %lld%s\n", e, fp_pow(two, e), e < 10 ? "," : "");
    }
    printf("    },\n");

    printf("    \"pow_3\": {\n");
    fixpt three = 3 * FP_FACTOR;
    for (int e = -3; e <= 5; e++) {
        printf("      \"%d\": %lld%s\n", e, fp_pow(three, e), e < 5 ? "," : "");
    }
    printf("    }\n");

    printf("  }\n");
    printf("}\n");

    return 0;
}
