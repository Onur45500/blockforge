/**
 * REFERENCE ONLY — copy into src/client/ for a coins HUD.
 * Not compiled from docs/examples.
 *
 * Expects player.leaderstats.Coins (see leaderstats.server.ts).
 */
import { Players } from "@rbxts/services";

const player = Players.LocalPlayer;
const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;
const stats = player.WaitForChild("leaderstats", 8);
if (stats === undefined) {
	warn("Coins HUD: leaderstats missing — copy leaderstats.server.ts first");
} else {
	const coinsInstance = stats.WaitForChild("Coins", 8);
	if (coinsInstance === undefined || !coinsInstance.IsA("IntValue")) {
		warn("Coins HUD: leaderstats.Coins missing");
	} else {
		const coins = coinsInstance;

		const gui = new Instance("ScreenGui");
		gui.Name = "CoinsHud";
		gui.ResetOnSpawn = false;
		gui.IgnoreGuiInset = true;
		gui.Parent = playerGui;

		const label = new Instance("TextLabel");
		label.Name = "CoinsLabel";
		label.AnchorPoint = new Vector2(0, 0);
		label.Position = new UDim2(0, 16, 0, 48);
		label.Size = new UDim2(0, 200, 0, 32);
		label.BackgroundTransparency = 0.3;
		label.BackgroundColor3 = Color3.fromRGB(20, 20, 24);
		label.TextColor3 = Color3.fromRGB(255, 220, 80);
		label.TextSize = 20;
		label.Font = Enum.Font.GothamBold;
		label.TextXAlignment = Enum.TextXAlignment.Left;
		label.Parent = gui;

		function setText(value: number): void {
			label.Text = `  Coins  ${value}`;
		}

		setText(coins.Value);
		coins.Changed.Connect(setText);
	}
}
