# Map mood briefs (non-script)

Use these as **world JSON** palettes. Do not download HDRIs from commercial banks. Copy materials/colors into `world/*.model.json` near spawn.

## Neon night market

Concrete + Neon. Dark grey floors `[0.12, 0.14, 0.18]`, magenta/cyan trim. Low walls, doorway on +Z. Lanterns = small Neon parts + PointLight (see `docs/examples/lighting/`).

## Tropical obby

Grass/Sand platforms stepping +X from spawn, 8–12 stud gaps, slight Y rises. Green checkpoints, red kill brick. See `ObbySegment.model.json`.

## Seaside town

SmoothPlastic docks at spawn Y, wood piers +X, water is **visual only** (blue transparent parts with `CanCollide: false` — never unanchored). Keep a solid walkway.

## Moon pad

Metal/DiamondPlate grey, sparse Neon strips, one bright SpawnLocation. Wide floor so players do not walk off into void.

## Medieval yard

Cobblestone floor, brick walls with a **door gap**, wood benches (`seat/Bench.model.json`). Warm PointLights, not invented textures.
