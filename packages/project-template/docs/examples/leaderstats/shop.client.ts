/**
 * REFERENCE ONLY — copy into src/client/ for a minimal spend-coins shop UI.
 * Requires Remotes/BuyItem created on the server (see leaderstats.server.ts).
 */
import { Players, ReplicatedStorage } from "@rbxts/services";

const player = Players.LocalPlayer;
const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;

const remotes = ReplicatedStorage.WaitForChild("Remotes");
const buyItem = remotes.WaitForChild("BuyItem") as RemoteEvent;

const gui = new Instance("ScreenGui");
gui.Name = "CoinShop";
gui.ResetOnSpawn = false;
gui.Parent = playerGui;

const frame = new Instance("Frame");
frame.Size = new UDim2(0, 220, 0, 120);
frame.Position = new UDim2(1, -240, 0, 20);
frame.BackgroundColor3 = Color3.fromRGB(30, 30, 36);
frame.Parent = gui;

const title = new Instance("TextLabel");
title.Size = new UDim2(1, -16, 0, 28);
title.Position = new UDim2(0, 8, 0, 8);
title.BackgroundTransparency = 1;
title.Text = "Shop";
title.TextColor3 = Color3.fromRGB(255, 255, 255);
title.TextSize = 20;
title.Font = Enum.Font.GothamBold;
title.Parent = frame;

const button = new Instance("TextButton");
button.Size = new UDim2(1, -16, 0, 36);
button.Position = new UDim2(0, 8, 0, 48);
button.BackgroundColor3 = Color3.fromRGB(40, 160, 90);
button.Text = "Buy item (25 coins)";
button.TextColor3 = Color3.fromRGB(255, 255, 255);
button.TextSize = 16;
button.Font = Enum.Font.Gotham;
button.Parent = frame;

button.MouseButton1Click.Connect(() => {
	buyItem.FireServer();
});
