/**
 * REFERENCE ONLY — copy into src/client/ for an inventory HUD.
 * Not compiled from docs/examples.
 *
 * Reads player.Inventory/Potion. Does not FireServer to add items.
 */
import { Players } from "@rbxts/services";

const player = Players.LocalPlayer;
const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;
const folder = player.WaitForChild("Inventory", 8);
if (folder === undefined) {
	warn("Inventory HUD: Inventory folder missing — copy inventory.server.ts first");
} else {
	const potionInstance = folder.WaitForChild("Potion", 8);
	if (potionInstance === undefined || !potionInstance.IsA("IntValue")) {
		warn("Inventory HUD: Potion value missing");
	} else {
		const potion = potionInstance;

		const gui = new Instance("ScreenGui");
		gui.Name = "InventoryHud";
		gui.ResetOnSpawn = false;
		gui.IgnoreGuiInset = true;
		gui.Parent = playerGui;

		const label = new Instance("TextLabel");
		label.Name = "PotionLabel";
		label.Position = new UDim2(0, 16, 0, 88);
		label.Size = new UDim2(0, 200, 0, 28);
		label.BackgroundTransparency = 0.3;
		label.BackgroundColor3 = Color3.fromRGB(20, 20, 24);
		label.TextColor3 = Color3.fromRGB(200, 170, 255);
		label.TextSize = 18;
		label.Font = Enum.Font.GothamBold;
		label.TextXAlignment = Enum.TextXAlignment.Left;
		label.Parent = gui;

		const setText = (value: number): void => {
			label.Text = `  Potions  ${value}`;
		};
		setText(potion.Value);
		potion.Changed.Connect(setText);
	}
}
