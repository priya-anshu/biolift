import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { getWorkoutPlannerApiContext } from "@/lib/workout-planner/apiContext";
import { getCalendarMonth, upsertCalendarStatus } from "@/lib/workout-planner/service";
import {
  parseMonthQuery,
  validateCalendarStatusRequest,
} from "@/lib/workout-planner/validation";

export async function GET(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "workout-planner-calendar-get",
      limit: 90,
      windowSeconds: 60,
    });
    const month = request.nextUrl.searchParams.get("month");
    const { monthStart, monthEnd } = parseMonthQuery(month);
    const items = await getCalendarMonth(
      { client: api.client, profileId: api.current.profileId },
      monthStart,
      monthEnd,
    );
    return NextResponse.json({ month, items });
  } catch (error) {
    return apiErrorResponse(error, "Failed to load calendar", {
      scope: "workout-planner.calendar.get",
    });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const api = await getWorkoutPlannerApiContext({
      routeKey: "workout-planner-calendar-upsert",
      limit: 120,
      windowSeconds: 60,
    });
    const payload = await request.json();
    const parsed = validateCalendarStatusRequest(payload);
    const item = await upsertCalendarStatus(
      { client: api.client, profileId: api.current.profileId },
      parsed,
    );
    return NextResponse.json({ item });
  } catch (error) {
    return apiErrorResponse(error, "Failed to save calendar status", {
      scope: "workout-planner.calendar.put",
    });
  }
}
