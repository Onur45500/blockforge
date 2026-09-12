-- REFERENCE ONLY — Studio MCP execute_luau after Rojo has synced studio-tools.
-- Do NOT paste studio-tools/MapToolkit.luau into this window.

local T = require(game.ReplicatedStorage.Blockforge.MapToolkit)

return {
	version = T.version(),
	zfight = T.auditZFight(),
	overlaps = T.auditOverlaps(),
	rigs = T.auditRigs(),
}
