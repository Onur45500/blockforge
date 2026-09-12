# `world/*.model.json` reference

Rojo syncs every `world/*.model.json` into `Workspace.World`. Prefer these files for **static** scenery. Put moving / reactive logic in `src/` TypeScript instead.

## Root shape

```json
{
  "ClassName": "Model",
  "Children": [ /* instances */ ]
}
```

Each child object:

| Field | Required | Notes |
|-------|----------|--------|
| `Name` | yes | Unique among siblings |
| `ClassName` | yes | Roblox class name (see below) |
| `Properties` | no | Object of property → value |
| `Children` | no | Nested instances |

## Supported ClassNames (common)

| ClassName | Use for |
|-----------|---------|
| `Model` | Grouping (root or nested) |
| `Folder` | Organization only |
| `Part` | Platforms, walls, floors, steps |
| `SpawnLocation` | Where players appear (exactly one enabled in the place) |
| `MeshPart` | Only with a real `MeshId` from `shared/assets` — never invent ids |
| `PointLight` / `SpotLight` / `SurfaceLight` | Lighting accents |
| `Attachment` | Mount points for effects |
| `ParticleEmitter` / `Fire` / `Smoke` / `Sparkles` | VFX (see `docs/examples/vfx/`) |
| `Seat` / `VehicleSeat` | Sit (see `docs/examples/seat/`) |
| `Decal` / `Texture` | Surfaces — `Texture` must be a real `rbxassetid://` from assets |

Create `ProximityPrompt` / `ClickDetector` in **TypeScript** on a named Part (see `docs/examples/door/` and `collect/`). Skip Script/LocalScript/ModuleScript in world JSON — gameplay belongs under `src/`.

## Property value formats

| Property | Type | Example |
|----------|------|---------|
| `Anchored` | boolean | `true` (**required** on every BasePart) |
| `Size` | `[x, y, z]` studs | `[40, 2, 40]` |
| `Position` | `[x, y, z]` world studs | `[0, 10, 0]` |
| `Orientation` | `[rx, ry, rz]` degrees | `[0, 90, 0]` |
| `Color` | `[r, g, b]` floats **0–1** | `[0.2, 0.9, 0.35]` |
| `Material` | string enum | `"SmoothPlastic"`, `"Neon"`, `"Wood"`, `"Concrete"`, `"Grass"`, `"Brick"`, `"Metal"`, `"Glass"` |
| `Transparency` | number 0–1 | `0.5` |
| `CanCollide` | boolean | `true` (default true; set false for decorations) |
| `CanTouch` | boolean | `true` |
| `CastShadow` | boolean | `true` |
| `Shape` | string (Part only) | `"Block"`, `"Ball"`, `"Cylinder"` |
| `Neutral` | boolean (SpawnLocation) | `true` |
| `Enabled` | boolean (SpawnLocation) | `true` |
| `Duration` | number (SpawnLocation) | `0` |
| `BrickColor` | avoid | Prefer `Color` |

### Cylinder upright (tree trunks / pillars)

Roblox `Shape: "Cylinder"` length is **Size.X** (the first component). Unrotated, the cylinder lies on its side along world X.

For an **upright** pillar (height along Y):

```json
"Shape": "Cylinder",
"Size": [8, 2, 2],
"Orientation": [0, 0, 90],
"Position": [x, groundY + 4, z]
```

- `Size[0]` = height, `Size[1]`/`Size[2]` = diameter.
- `Orientation: [0, 0, 90]` stands it up. Do **not** use `[90, 0, 0]` with `Size: [2, 8, 2]` — that is a common mistake (fat disk / floating trunk).
- Prefer Asset-bank tree meshes (`kenney_tree`, `quat_tree_pine`) over Cylinder+Ball trees — see `docs/examples/nature/`.

Do **not** invent `MeshId`, `Texture`, or other `rbxassetid://` values. Import through the Blockforge Asset bank → `shared/assets.ts`.

## Coordinate conventions

- Axes: **Y-up**. +X right, +Z toward camera-ish depending on Studio view.
- Template spawn: ground top near **Y ≈ 11**, `SpawnLocation` at roughly **`[0, 11.5, 0]`** on a **`[40, 2, 40]`** platform at `[0, 10, 0]`.
- Player height ≈ **5 studs**. Walkable platform thickness usually **1–2** studs; walkable width/depth **≥ 8** studs.
- Place new builds **near spawn** (within ~100 studs unless the user asks for a distant area).
- Leave a real **doorway gap** — never seal the spawn with a solid wall.
- Stack parts so the top face is continuous; avoid invisible gaps players fall through.

## Minimal spawn platform

```json
{
  "ClassName": "Model",
  "Children": [
    {
      "Name": "GroundPlatform",
      "ClassName": "Part",
      "Properties": {
        "Anchored": true,
        "Size": [40, 2, 40],
        "Position": [0, 10, 0],
        "Material": "SmoothPlastic",
        "Color": [0.55, 0.55, 0.6]
      }
    },
    {
      "Name": "DefaultSpawn",
      "ClassName": "SpawnLocation",
      "Properties": {
        "Anchored": true,
        "Size": [6, 1, 6],
        "Position": [0, 11.5, 0],
        "Neutral": true,
        "Enabled": true,
        "Duration": 0,
        "Material": "Neon",
        "Color": [0.2, 0.9, 0.35]
      }
    }
  ]
}
```

## Checklist before done

1. Valid JSON.
2. Every BasePart (`Part`, `SpawnLocation`, `MeshPart`, …) has `"Anchored": true`.
3. Exactly one enabled `SpawnLocation` across all `world/*.model.json` files.
4. Spawn sits on a walkable surface (spawn bottom ≈ ground top).
5. `npm run validate:world` exits 0.
6. User can hit **Play** in Studio without falling into the void.

See also: `docs/examples/README.md` for lobby / obby / teleport / HUD / VFX samples.
