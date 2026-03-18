# BioLift Codebase Analysis

## 1. Overview and Tech Stack
BioLift is a fitness companion application built with a modern web stack:
- **Framework**: Next.js 16.1 (App Router) with React 19.
- **Styling**: Tailwind CSS v4, utilizing a custom day/night theme, alongside Framer Motion for animations and Lucide React for iconography.
- **Backend & Database**: Supabase SSR for authentication and PostgreSQL for the database.
- **Data Visualization**: Recharts for tracking progress and analytics.

## 2. System Architecture
The application follows a clean client-server-worker architecture:
- **Next.js UI (Frontend)**: Interacts with the user, sending requests to the API.
- **Next.js API Routes (Backend Layer)**: Handles incoming requests from the frontend and enqueues background jobs.
- **Job Queue (`ai_job_queue`) & Worker (`workerQueue.ts`)**: Manages processing-intensive tasks asynchronously.
- **Engines**: The core AI logic operates through three integrated engines:
  - `recoveryEngine.ts` (Recovery Engine)
  - `trainingLoadEngine` (Training Load)
  - `trainingBrain.ts` (Training Brain)
- **Data Flow**: The engines produce *Analytics Snapshots* (`user_training_stats`, `exercise_volume_stats`) and *AI Recommendations* (`ai_recommendations`), which are then served back to the Frontend UI.

## 3. Directory Structure Analysis

### `app/` (Application Routing)
Uses the Next.js App Router paradigm. Distinct route segments include:
- **Authentication Routes**: `/signin`, `/forgot-password`, `/reset-password`, `/auth/callback`.
- **User Dashboard (`/dashboard/*`)**: Contains features such as diet, profile, progress tracking, physical rankings, shop, social integrations, and workout planning modules.
- **Admin Panel (`/admin/*`)**: Secure pages for managing users, overseeing the dashboard, and an AI queue.
- **API Routes (`/api/*`)**: Serverless endpoints for admin actions, cron jobs (AI workers), dashboard data summaries, injury flags, progress logging, and rigorous workout planning (generations, logs, calendars).

### `components/` (UI & Feature Components)
Structured modularly into categorical domains:
- `ai/`: Components related to AI feedback or chat interfaces.
- `charts/`: Data visualization fragments likely leveraging Recharts.
- `recovery/` & `training/`: Specialized UI parts corresponding to the core engines.
- `ui/`: Common generic UI components.
- `workout/`: Components specialized for creating or executing workouts.
- Standard utility components like [ExerciseImage.tsx](file:///c:/Users/priya/Desktop/biolift/components/ExerciseImage.tsx) and PWA registrations ([PwaRegister.tsx](file:///c:/Users/priya/Desktop/biolift/components/PwaRegister.tsx)).

### `lib/` (Core Libraries and Utilities)
Contains centralized utilities, abstractions, and environment setup:
- `auth/` & `security/`: Handlers for Supabase identity operations and request validations.
- `server/` & `runtime/`: Core engine implementations and execution contexts.
- `supabase/`: Database client configurations using `@supabase/ssr`.
- `workout-planner/`: Utilities driving the AI workout generation.
- `theme/` & `utils/`: Reusable helpers and style tokens.

### `database/` (PostgreSQL Schema & Interactions)
Includes a comprehensive database architecture script ([database.sql](file:///c:/Users/priya/Desktop/biolift/database/database.sql) - ~106KB dump) alongside separated domains:
- `schema/` (Core Tables), `rls/` (Row Level Security), `permissions/` (Grants), `security_checks/` (Validation).
- Specialized directories: `progress/`, `ranking/`, `workout_planner/`, and `profile_settings/`.
- The database acts not just as storage but as a secure source of truth utilizing Supabase's capabilities.

## 4. Conclusion
The repository leverages Next.js 16 to its full capability (React Server Components, parallel routes, and expansive API routes) tied to Supabase for heavy lifting in Auth and DB operations. The AI implementation is isolated in worker queues (`lib/server/ai` inferred from routes) keeping the frontend highly performant. The extensive modularity in both code (`components`, `lib`) and SQL data definitions makes the project highly extensible.
