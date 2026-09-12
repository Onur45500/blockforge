/**
 * REFERENCE ONLY — copy into src/shared/ensure-remotes.ts.
 * Not compiled from docs/examples.
 *
 * Call from server scripts only. Clients must WaitForChild("Remotes"), never create.
 * Combining examples (shop + rng + teleport FX) will share one folder.
 */
import { ReplicatedStorage } from "@rbxts/services";

export function ensureRemotesFolder(): Folder {
	const existing = ReplicatedStorage.FindFirstChild("Remotes");
	if (existing !== undefined && existing.IsA("Folder")) {
		return existing;
	}
	const remotes = new Instance("Folder");
	remotes.Name = "Remotes";
	remotes.Parent = ReplicatedStorage;
	return remotes;
}

export function ensureRemoteEvent(name: string): RemoteEvent {
	const remotes = ensureRemotesFolder();
	const existing = remotes.FindFirstChild(name);
	if (existing !== undefined && existing.IsA("RemoteEvent")) {
		return existing;
	}
	const remote = new Instance("RemoteEvent");
	remote.Name = name;
	remote.Parent = remotes;
	return remote;
}
