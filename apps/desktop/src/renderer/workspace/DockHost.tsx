import type { CSSProperties, ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { DockSlot, type DockSlotItem } from "./DockPanel";
import type { DockId, WorkspaceLayoutState } from "./workspace-types";

/**
 * Applied to the library's *inner* panel wrapper.
 * react-resizable-panels sets `overflow: auto` inline; that lets children
 * size to content and leaves a hole under the terminal. Overflow hidden +
 * column flex makes the PTY/dock fill the panel.
 */
const PANEL_FILL: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  minWidth: 0,
  overflow: "hidden",
};

type DockHostProps = {
  layout: WorkspaceLayoutState;
  leftContent: DockSlotItem[];
  rightContent: DockSlotItem[];
  bottomContent: DockSlotItem[];
  activeLeftId: DockId | null;
  activeRightId: DockId | null;
  activeBottomId: DockId | null;
  center: ReactNode;
  onSelectDock: (id: DockId) => void;
  onCloseDock: (id: DockId) => void;
  onLayoutChange: (sizes: Partial<WorkspaceLayoutState["panelSizes"]>) => void;
};

function pct(n: number): string {
  return `${n}%`;
}

export function DockHost({
  layout,
  leftContent,
  rightContent,
  bottomContent,
  activeLeftId,
  activeRightId,
  activeBottomId,
  center,
  onSelectDock,
  onCloseDock,
  onLayoutChange,
}: DockHostProps) {
  const showLeft = !layout.quietMode && leftContent.length > 0;
  const showRight = !layout.quietMode && rightContent.length > 0;
  const showBottom = !layout.quietMode && bottomContent.length > 0;

  const mainRow = (
    <Group
      orientation="horizontal"
      className="ws-panel-group"
      style={{ minHeight: 0, minWidth: 0 }}
      onLayoutChanged={(next) => {
        onLayoutChange({
          left: typeof next.left === "number" ? next.left : layout.panelSizes.left,
          center:
            typeof next.center === "number" ? next.center : layout.panelSizes.center,
          right:
            typeof next.right === "number" ? next.right : layout.panelSizes.right,
        });
      }}
    >
      {showLeft ? (
        <>
          <Panel
            id="left"
            defaultSize={pct(layout.panelSizes.left)}
            minSize="16%"
            maxSize="46%"
            className="ws-side-slot"
            style={PANEL_FILL}
          >
            <DockSlot
              side="left"
              items={leftContent}
              activeId={activeLeftId}
              onSelect={onSelectDock}
              onClose={onCloseDock}
            />
          </Panel>
          <Separator className="ws-separator" />
        </>
      ) : null}
      <Panel
        id="center"
        defaultSize={pct(layout.panelSizes.center)}
        minSize="42%"
        className="ws-center-slot"
        style={PANEL_FILL}
      >
        {center}
      </Panel>
      {showRight ? (
        <>
          <Separator className="ws-separator" />
          <Panel
            id="right"
            defaultSize={pct(layout.panelSizes.right)}
            minSize="22%"
            maxSize="36%"
            className="ws-side-slot"
            style={PANEL_FILL}
          >
            <DockSlot
              side="right"
              items={rightContent}
              activeId={activeRightId}
              onSelect={onSelectDock}
              onClose={onCloseDock}
            />
          </Panel>
        </>
      ) : null}
    </Group>
  );

  if (!showBottom) {
    return <div className="ws-dock-host">{mainRow}</div>;
  }

  return (
    <div className="ws-dock-host">
      <Group
        orientation="vertical"
        className="ws-panel-group"
        style={{ minHeight: 0, minWidth: 0 }}
        onLayoutChanged={(next) => {
          onLayoutChange({
            main: typeof next.main === "number" ? next.main : layout.panelSizes.main,
            bottom:
              typeof next.bottom === "number"
                ? next.bottom
                : layout.panelSizes.bottom,
          });
        }}
      >
        <Panel
          id="main"
          defaultSize={pct(layout.panelSizes.main)}
          minSize="55%"
          className="ws-panel-fill"
          style={PANEL_FILL}
        >
          {mainRow}
        </Panel>
        <Separator className="ws-separator horizontal" />
        <Panel
          id="bottom"
          defaultSize={pct(layout.panelSizes.bottom)}
          minSize="12%"
          maxSize="50%"
          className="ws-bottom-slot"
          style={PANEL_FILL}
        >
          <DockSlot
            side="bottom"
            items={bottomContent}
            activeId={activeBottomId}
            onSelect={onSelectDock}
            onClose={onCloseDock}
          />
        </Panel>
      </Group>
    </div>
  );
}
