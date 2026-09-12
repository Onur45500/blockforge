/**
 * REFERENCE ONLY — copy into src/server/ for a slow day/night cycle.
 * Not compiled from docs/examples.
 */
import { Lighting, RunService } from "@rbxts/services";

const HOURS_PER_SECOND = 0.05;

RunService.Heartbeat.Connect((dt) => {
	Lighting.ClockTime = (Lighting.ClockTime + dt * HOURS_PER_SECOND) % 24;
});
