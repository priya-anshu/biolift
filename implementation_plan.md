# Zod Global Validation Implementation Plan

This document outlines the systematic plan to replace the fragile manual TypeScript casting in our Next.js API Routes with robust runtime validation via `Zod`. This addresses the security vulnerability of mass assignment and payload schema discrepancies.

## Proposed Changes

### 1. New Schemas Directory (`lib/schemas/`)
We will create a centralized schema directory logic inside `lib/`.

#### [NEW] [workoutSession.ts](file:///c:/Users/priya/Desktop/biolift/lib/schemas/workoutSession.ts)
*   **SaveSetSchema**: For saving individual workout sets (exercise_id, reps, weight, RPE).
*   **DeleteSetSchema**: For identifying and removing sets.
*   **FinishSchema**: For finishing active workout sessions.

#### [NEW] [workoutPlanner.ts](file:///c:/Users/priya/Desktop/biolift/lib/schemas/workoutPlanner.ts)
*   **PlannerRequestSchema**: Replaces [validatePlannerRequest](file:///c:/Users/priya/Desktop/biolift/lib/workout-planner/validation.ts#121-157). Validates goal, experience level, workout days.
*   **ManualPlanRequestSchema**: Validates creation of manual custom plans.
*   **PlanExercisePatchSchema**: Validates arrays of exercises for plan updates.

#### [NEW] [progress.ts](file:///c:/Users/priya/Desktop/biolift/lib/schemas/progress.ts)
*   **WeightLogSchema**: Prevents negative or unrealistic weight logs.

### 2. API Route Refactoring
The following API routes currently use `await request.json() as Type` or manual validation. They will be updated to use `.safeParse()` instead.

#### [MODIFY] [session route.ts](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts)
Applies to [PATCH](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#833-890), [DELETE](file:///c:/Users/priya/Desktop/biolift/app/api/workout/session/route.ts#891-925), and [POST](file:///c:/Users/priya/Desktop/biolift/app/api/workout-planner/generate/route.ts#13-60) methods using `workoutSession.ts` schemas.

#### [MODIFY] [generate route.ts](file:///c:/Users/priya/Desktop/biolift/app/api/workout-planner/generate/route.ts)
Replaces [validatePlannerRequest()](file:///c:/Users/priya/Desktop/biolift/lib/workout-planner/validation.ts#121-157) with `PlannerRequestSchema.safeParse()`.

#### [MODIFY] [manual route.ts](file:///c:/Users/priya/Desktop/biolift/app/api/workout-planner/manual/route.ts)
Uses `ManualPlanRequestSchema.safeParse()`.

#### [MODIFY] [plans route.ts](file:///c:/Users/priya/Desktop/biolift/app/api/workout-planner/plans/[id]/route.ts)
Applies to updating existing plans with `PlanExercisePatchSchema.safeParse()`.

#### Error Handling 
For all modified routes, failed Zod parses will return an immediate `HTTP 400 Bad Request` containing the specific mismatched errors from the `ZodError` object.

```typescript
const payload = await request.json();
const parsedResult = Schema.safeParse(payload);
if (!parsedResult.success) {
  return Response.json(
    { error: "Invalid request payload", details: parsedResult.error.format() },
    { status: 400 }
  );
}
const body = parsedResult.data;
```

## Verification Plan

### Automated Tests
*   Run the Next.js TypeScript compiler (`npx tsc --noEmit`) to verify that the newly typed Zod payloads (`z.infer<typeof Schema>`) perfectly match the expected downstream TS types (such as `ServiceContext` and database insertion helpers).
*   Send valid payload structure cURL requests to ensure a `200 OK` is correctly bypassed.
*   Send invalid payload structure cURL requests with missing properties, ensuring a `400 Bad Request` with `{ error: "Invalid request payload" }` is correctly triggered without shutting down the server.
