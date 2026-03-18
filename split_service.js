const fs = require('fs');
const path = require('path');

const srcFile = path.resolve('lib', 'workout-planner', 'service.ts');
const targetDir = path.resolve('lib', 'services', 'workout');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const lines = fs.readFileSync(srcFile, 'utf8').split('\n');
function getLines(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

function exportify(text) {
  return text.split('\n').map(line => {
    if (/^(type|function|const)\s/.test(line) && !line.startsWith('export const EXERCISE_CATALOG_LIST_SELECT')) {
      return `export ${line}`;
    }
    return line;
  }).join('\n');
}

// 1. types.ts
const typesTs = `
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TrainingIntelligenceResult } from "@/lib/workout-planner/intelligenceEngine";

${exportify(getLines(19, 43))}

${exportify(getLines(50, 61))}

${exportify(getLines(63, 87))}

${exportify(getLines(89, 109))}

${exportify(getLines(111, 135))}

${exportify(getLines(996, 1001))}
`;
fs.writeFileSync(path.join(targetDir, 'types.ts'), typesTs.trim());

// 2. utils.ts
const utilsTs = `
${exportify(getLines(137, 164))}

${exportify(getLines(1454, 1475))}

${exportify(getLines(1983, 1995))}

${exportify(getLines(1997, 2003))}
`;
fs.writeFileSync(path.join(targetDir, 'utils.ts'), utilsTs.trim());

// 3. recommendation.service.ts
const recommendationTs = `
import { getNextWorkoutRecommendations, type TrainingIntelligenceRequest, type TrainingIntelligenceResult } from "@/lib/workout-planner/intelligenceEngine";
import { applyTrainingBrain } from "@/lib/workout-planner/trainingBrain";
import type { ServiceContext, NormalizedRecommendationRequest, WorkoutRecommendationRead } from "./types";
import { clampIntValue, parseNumeric } from "./utils";

${getLines(45, 48)}

${getLines(166, 196)}

${getLines(198, 236)}

${getLines(238, 240)}

${getLines(242, 244)}

${getLines(246, 299)}

${getLines(301, 324)}

${getLines(326, 434)}

${getLines(436, 465)}

${getLines(1369, 1420)}

${getLines(1422, 1452)}
`;
fs.writeFileSync(path.join(targetDir, 'recommendation.service.ts'), recommendationTs.trim());

// 4. planBuilder.service.ts
const planBuilderTs = `
import { buildSmartExercises } from "@/lib/workout-planner/smartPlanner";
import type { ManualPlanRequest, PlanExerciseInput, PlannerRequest, ExerciseCatalogRow } from "@/lib/workout-planner/types";
import { ServiceContext, WorkoutPlanInsert, PlanExerciseRead, PlanWithExercisesRead, ExerciseSearchInput, CreateCustomExerciseInput, ExerciseSuggestionInput, UpdatePlanInput, EXERCISE_CATALOG_LIST_SELECT } from "./types";
import { toDayIndex, normalizeToken, normalizeStringArray, slugifyExerciseName, clampIntValue, parseNumeric } from "./utils";

${getLines(467, 480)}

${getLines(482, 494)}

${getLines(496, 549)}

${getLines(551, 600)}

${getLines(602, 648)}

${getLines(650, 663)}

${getLines(665, 704)}

${getLines(706, 754)}

${getLines(756, 850)}

${getLines(852, 882)}

${getLines(884, 928)}

${getLines(930, 994)}

${getLines(1003, 1045)}

${getLines(1047, 1053)}
`;
fs.writeFileSync(path.join(targetDir, 'planBuilder.service.ts'), planBuilderTs.trim());

// 5. execution.service.ts
const executionTs = `
import type { CalendarStatusRequest, CalendarDayStatus, WorkoutLogRequest } from "@/lib/workout-planner/types";
import type { ServiceContext } from "./types";
import { toDayIndex, clampIntValue, parseNumeric } from "./utils";

${getLines(1055, 1062)}

${getLines(1064, 1145)}

${getLines(1147, 1180)}

${getLines(1182, 1235)}

${getLines(1237, 1255)}

${getLines(1257, 1367)}

${getLines(1865, 1981)}
`;
fs.writeFileSync(path.join(targetDir, 'execution.service.ts'), executionTs.trim());

// 6. analytics.service.ts
const analyticsTs = `
import type { ServiceContext } from "./types";
import { getMotivationSnapshot } from "./execution.service";
import { clampIntValue, parseNumeric, toIsoDateOnly, daysAgoDate, computeDateStreak, tierForScore } from "./utils";

${getLines(1477, 1625)}

${getLines(1627, 1835)}

${getLines(1837, 1863)}

${getLines(2005, 2149)}

${getLines(2151, 2185)}
`;
fs.writeFileSync(path.join(targetDir, 'analytics.service.ts'), analyticsTs.trim());

// 7. Re-write service.ts
const newServiceTs = '// Facade for backward compatibility\n' +
'export * from "../services/workout/types";\n' +
'export * from "../services/workout/recommendation.service";\n' +
'export * from "../services/workout/planBuilder.service";\n' +
'export * from "../services/workout/execution.service";\n' +
'export * from "../services/workout/analytics.service";\n';

fs.writeFileSync(srcFile, newServiceTs);

console.log('Successfully split lib/workout-planner/service.ts into 6 smaller modules inside lib/services/workout/');
