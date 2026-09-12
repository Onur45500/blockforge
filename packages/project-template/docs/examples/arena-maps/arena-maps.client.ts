/**
 * REFERENCE ONLY — copy into src/client/ for an arena round-timer HUD.
 * Not compiled from docs/examples.
 *
 * Reads ReplicatedStorage.ArenaStatus (created by arena-maps.server.ts).
 */
import { Players, ReplicatedStorage } from "@rbxts/services";

const player = Players.LocalPlayer;
const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;
const statusInstance = ReplicatedStorage.WaitForChild("ArenaStatus", 8);
if (statusInstance === undefined || !statusInstance.IsA("StringValue")) {
	warn("Arena HUD: ArenaStatus missing — copy arena-maps.server.ts first");
} else {
	const status = statusInstance;

	const gui = new Instance("ScreenGui");
	gui.Name = "ArenaHud";
	gui.ResetOnSpawn = false;
	gui.IgnoreGuiInset = true;
	gui.Parent = playerGui;

	const label = new Instance("TextLabel");
	label.Name = "ArenaLabel";
	label.AnchorPoint = new Vector2(0.5, 0);
	label.Position = new UDim2(0.5, 0, 0, 16);
	label.Size = new UDim2(0, 280, 0, 32);
	label.BackgroundTransparency = 0.3;
	label.BackgroundColor3 = Color3.fromRGB(20, 20, 24);
	label.TextColor3 = Color3.fromRGB(230, 230, 240);
	label.TextSize = 18;
	label.Font = Enum.Font.GothamBold;
	label.Parent = gui;

	function setText(value: string): void {
		label.Text = value;
	}

	setText(status.Value);
	status.Changed.Connect(setText);
}
