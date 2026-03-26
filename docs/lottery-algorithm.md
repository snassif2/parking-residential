# Lottery Algorithm

## Priority Order

Before any random draw, spots are allocated in strict priority:

```
1st — Fixed spots (units 191–196): immutable, never drawn
2nd — Preferential spots: assigned directly by law (PCD, Idoso, Gestante)
3rd — Lottery: remaining eligible units drawn via Fisher-Yates
4th — Manual assignment: remaining/reserved spots for ineligible units
```

## Pre-Lottery Checklist

The system must display before executing:

| Item | Description |
|------|-------------|
| Eligible units | Units cleared for the draw |
| Preferential units | Removed from draw (legal requirement) |
| Ineligible units | Defaulters — waiting for manual spot assignment |
| Fixed units | 19th floor specials — never drawn |
| Available spots | Pool for the lottery |
| Preferential spots | Reserved for preferential units |
| Fixed spots | Permanently assigned |
| Reserved spots | Set aside for ineligible units |

## Fisher-Yates Shuffle

Pure function — deterministic given the same seed.

```typescript
// Seeded PRNG: splitmix32
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s ^= s >>> 16;
    return (s >>> 0) / 4294967296;
  };
}

function fisherYatesShuffle<T>(array: T[], seed: number): {
  result: T[];
  seed: number;
  steps: Array<{ i: number; j: number }>;  // full audit trail
} {
  const result = [...array];
  const rng = seededRandom(seed);
  const steps: Array<{ i: number; j: number }> = [];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    steps.push({ i, j });
    [result[i], result[j]] = [result[j], result[i]];
  }

  return { result, seed, steps };
}
```

## Seed Generation

```
seed = Date.now() XOR hash(condoId) XOR hash(cycleId)
```

The seed is stored alongside the result. Any party with the stored seed and input arrays can re-run the algorithm and independently verify the output.

## Lottery Execution Steps

1. **Remove from pool:** fixed spots + assigned preferential spots + reserved spots
2. **Separate pairs:** spots with a `parVaga` link → assigned together to 2-spot units
3. **Separate singles:** remaining spots → assigned to 1-spot units
4. **Shuffle pairs** with Fisher-Yates (seeded)
5. **Shuffle singles** with Fisher-Yates (same seed + offset)
6. **Assign:** first N pairs → 2-spot eligible units; first M singles → 1-spot eligible units
7. **Remainder:** unassigned spots available for manual assignment to ineligible units

## Test vs Official Mode

| | Test | Official |
|--|------|---------|
| Executes algorithm | Yes | Yes |
| Shows result | Yes (watermark "SIMULAÇÃO") | Yes |
| Saved to history | No | Yes (append-only) |
| DynamoDB TTL | 7 days | Never expires |
| Double confirmation | No | Yes |
| PDF export | No | Yes |
| Seed recorded | No | Yes |

## Auditing a Result

Given a stored SORTEIO record:

1. Extract `semente`, `atribuicoes` input pools, and `passosFisherYates`
2. Re-run `fisherYatesShuffle(inputPool, semente)`
3. Verify `steps` array matches stored `passosFisherYates`
4. Verify final `result` matches stored `atribuicoes`

If all match, the result is verified as unaltered.
