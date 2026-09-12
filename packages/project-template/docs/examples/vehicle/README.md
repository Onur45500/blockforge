# Vehicle kart (reference only)

Copy `VehicleKart.model.json` into `world/` and `vehicle.server.ts` into `src/server/`.

Sit in `DriveSeat`. Chassis parts stay **Anchored** in JSON. The server `PivotTo`s the model from `VehicleSeat.Throttle` / `Steer` with a speed cap. Unanchored physics vehicles are out of this MVP.
