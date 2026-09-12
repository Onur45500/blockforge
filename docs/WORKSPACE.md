# Desktop workspace

Blockforge’s project view is an agent-first multi-panel shell (not a classic sidebar app).

## Chrome

| Surface | Role |
|---------|------|
| Top bar | Brand, project switcher, inspector tools, Sync pill, Quiet / Split, Cmd+K, Close project |
| Header tools | Switch inspector (one at a time): Sync, Git, Assets, Publish, Monetization, Credits; Agents (bottom, independent); Doctor + Settings overlays. Below ~1180px, overflow tools move into **More**. Below ~1040px the tool row wraps under brand + project. |
| Center | Main agent terminal (hero) + extra / worker tabs / optional split |
| Terminal tabs | Switch sessions. **Main agent** is the one you talk to; **Extra agent** is another window you opened; names like World Builder come from teammates the main agent started. Close via the tab ✕ (title-bar ✕ appears in Split view). |
| Inspector | Single right panel — opening another tool replaces the current one (does not stack). Title lives in the dock header only; body is flush sections (no nested page title, no decorative cards). |
| Agents | Optional bottom dock (short help + New terminal); can stay open with the inspector. Esc does not close Agents. |
| Quiet mode | Hide docks; terminals + Sync pill only. Independent of Split — both can be on (two terminals, no inspector). |
| Split | Main agent and another running terminal side by side. Independent of Quiet. |
| Doctor / Settings | Overlay / right drawer (not permanent nav) |

Esc: closes Doctor, then Settings, then the inspector (not Agents). Overlays and the More menu close first.

Layout persistence: `localStorage` key `blockforge.ui-layout.<projectId>` (open docks, sizes, quiet/split, lead/active session ids). Panel percentages are clamped so a saved Agents dock cannot crush the terminal.

## Layout fill

The workspace is a column flex chain (`html` → `#root` → `.ws-shell` → `.ws-body` → `.ws-dock-host` → terminal stage). Growing regions use `flex: 1 1 0` and `min-height: 0`, not `height: 100%`.

`react-resizable-panels` sets `overflow: auto` on the inner panel; DockHost overrides that with `PANEL_FILL` (`overflow: hidden` + column flex) so terminals fill the panel instead of leaving a hole under the PTY. Do not drop that style when adding panels.

Shortcuts: `Ctrl/Cmd+K` palette, `Ctrl/Cmd+Shift+T` new terminal, `Ctrl/Cmd+1` focus lead, `Ctrl/Cmd+Shift+B` quiet, `Ctrl/Cmd+,` settings.

## Agent UI terminals

Lead Claude (or any agent) can spawn Electron PTYs without the human clicking “New terminal”:

```bash
node scripts/blockforge-ui-terminal.mjs spawn --adapter claude-code --label world-builder
node scripts/blockforge-ui-terminal.mjs status
```

- Commands append to `.blockforge/agent-ui-commands.jsonl` (watched by main).
- Status mirror: `.blockforge/terminals.json` + `pty:status-changed` IPC.
- Default: do **not** steal focus from the lead unless `focus: true`.

Prefer Claude Code **Agent Teams** for in-process Claude workers; use UI terminals for other adapters or visible side-by-side PTYs. Disk + Rojo remain source of truth.

## Host Blockforge MCP

Project `.mcp.json` registers:

1. `Roblox_Studio` — official Studio MCP (inspect / playtest).
2. `blockforge` — stdio launcher → local HTTP gateway (`BLOCKFORGE_MCP_URL`, default `http://127.0.0.1:34874`) for studio turn lock, `playtest_check`, bank search, `generate_icon`, `user_asset_choice`, `notify_desktop`, auth nudge.

Agents receive `BLOCKFORGE_PROJECT_PATH`, `BLOCKFORGE_SESSION_ID`, `BLOCKFORGE_AGENT_LABEL`, `BLOCKFORGE_ADAPTER_ID`, `BLOCKFORGE_MCP_URL`, and `BLOCKFORGE_MCP_TOKEN` in the PTY environment.
