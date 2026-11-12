import { z } from "zod";
import { ColorKey, IsoDate, Satang } from "./common.js";
import { CityLeg } from "./models.js";

const name = z.string().trim().min(1).max(100);

/** B1 POST /api/trips */
export const CreateTripInput = z.strictObject({
  name,
  destination: name,
  startDate: IsoDate,
  endDate: IsoDate,
  budget: Satang.nullable().default(null),
  cover: ColorKey,
  legs: z.array(CityLeg).max(60).optional(),
  meetingPoint: z.string().trim().min(1).max(200).optional(),
  /** Other people on the trip, created as Unclaimed Members. */
  members: z.array(z.strictObject({ displayName: z.string().trim().min(1).max(50) })).max(49).default([]),
});

/** B2 PATCH /api/trips/:tripId — `null` removes `legs` / `meetingPoint`. */
export const UpdateTripInput = z.strictObject({
  name: name.optional(),
  destination: name.optional(),
  startDate: IsoDate.optional(),
  endDate: IsoDate.optional(),
  budget: Satang.nullable().optional(),
  cover: ColorKey.optional(),
  legs: z.array(CityLeg).max(60).nullable().optional(),
  meetingPoint: z.string().trim().min(1).max(200).nullable().optional(),
});

export const TripListQuery = z.object({ tab: z.enum(["upcoming", "past"]).optional() });
