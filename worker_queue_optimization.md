# [workerQueue.ts](file:///c:/Users/priya/Desktop/biolift/lib/workout-planner/workerQueue.ts) N+1 Elimination Report

The [lib/workout-planner/workerQueue.ts](file:///c:/Users/priya/Desktop/biolift/lib/workout-planner/workerQueue.ts) file has been completely refactored to eliminate N+1 querying patterns during massive daily cron-job refreshes. 

## 1. The Problem
Within the [enqueueDailyRefreshForActiveUsers()](file:///c:/Users/priya/Desktop/biolift/lib/workout-planner/workerQueue.ts#393-464) function, a massive array of active users (up to `10000`) was iterated over in chunks of 100. 
For every single user in the chunk, the system called [enqueueAiJob()](file:///c:/Users/priya/Desktop/biolift/lib/workout-planner/workerQueue.ts#303-345), which internally performed:
1. An Upsert Check (`.upsert()`) against the `ai_job_queue` table.
2. A duplicate error catch-and-retry insert.

If there were 5,000 active users, this single background worker cycle would bombard the Supabase database with **over 5,000 independent network HTTP loops**. 

## 2. The Solution
We have modified the logic to utilize native Postgres bulk operations combined with Postgres constraint handling:

```typescript
for (const userIdChunk of chunk(userIds, 500)) {
  const jobs = userIdChunk.map((userId) => ({
    user_id: userId,
    job_type: "daily_refresh",
    payload: { workoutDate, lookbackDays: DEFAULT_LOOKBACK_DAYS },
    dedupe_key: `daily_refresh:${userId}:${workoutDate}`,
    status: "pending",
    run_after: runAfter,
    priority,
  }));

  await client.from("ai_job_queue").upsert(jobs, {
    onConflict: "dedupe_key",
    ignoreDuplicates: true,
  });
}
```

Instead of sending 5,000 queries, we now break the array into chunks of 500, converting the entire operation into just **10 massive bulk HTTP calls**. 
Deduplication logic is offloaded directly to the Supabase database engine via `ignoreDuplicates: true` and the existing generic table constraint on the `dedupe_key` column.

## 3. Estimated Performance Improvements
* **Queries Executed**: Reduced from N (e.g. 5,000+) to ~ `[N / 500]` (e.g. 10 queries).
* **Execution Time**: The script will no longer wait for sequential HTTP handshakes from the Supabase Data API. Expected time drop from ~150+ seconds down to **< 2 seconds**.
* **Database Load**: Drastically reduces Postgres connection thread exhaustion and PGBouncer queue backup issues during midnight cron windows.
