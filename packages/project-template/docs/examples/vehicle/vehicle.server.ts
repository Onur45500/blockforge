/**
 * REFERENCE ONLY — copy into src/server/ for a sit-to-drive kart.
 * Not compiled from docs/examples.
 *
 * World JSON stays Anchored (validate:world). Server PivotTo from VehicleSeat throttle/steer.
 * Physics-welded unanchored chassis is out of this MVP.
 */
import { RunService, Workspace } from "@rbxts/services";

const MAX_SPEED = 40;
const TURN_SPEED = 1.4;

function findKart(): Model | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const kart = world.FindFirstChild("VehicleKart");
	return kart !== undefined && kart.IsA("Model") ? kart : undefined;
}

const kart = findKart();
if (kart !== undefined) {
	const seat = kart.FindFirstChild("DriveSeat");
	if (seat !== undefined && seat.IsA("VehicleSeat")) {
		kart.PrimaryPart = seat;
		RunService.Heartbeat.Connect((dt) => {
			if (seat.Occupant === undefined) {
				return;
			}
			const throttle = math.clamp(seat.Throttle, -1, 1);
			const steer = math.clamp(seat.Steer, -1, 1);
			const yaw = steer * TURN_SPEED * dt;
			const moved = kart.GetPivot().mul(CFrame.Angles(0, yaw, 0));
			const delta = moved.LookVector.mul(MAX_SPEED * throttle * dt);
			kart.PivotTo(moved.add(delta));
		});
	}
}
