"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Clock,
  Flame,
  Calendar,
  Search,
  TrendingUp,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";

type Workout = {
  id: string;
  name: string;
  type: string | null;
  duration_minutes: number | null;
  calories: number | null;
  performed_at: string;
};

export default function WorkoutsPage() {
  const { user } = useAuth();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("date");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!profile?.id) {
        setLoading(false);
        return;
      }
      setProfileId(profile.id);

      const { data } = await supabase
        .from("workouts")
        .select("id,name,type,duration_minutes,calories,performed_at")
        .eq("user_id", profile.id)
        .order("performed_at", { ascending: false });

      setWorkouts((data as Workout[]) ?? []);
      setLoading(false);
    };
    load();
  }, [user]);

  const filteredWorkouts = useMemo(() => {
    const filtered = workouts.filter((workout) => {
      const matchesSearch = workout.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesType =
        filterType === "all" ||
        (workout.type ?? "").toLowerCase() === filterType;
      return matchesSearch && matchesType;
    });

    return filtered.sort((a, b) => {
      if (sortBy === "date") {
        return (
          new Date(b.performed_at).getTime() -
          new Date(a.performed_at).getTime()
        );
      }
      if (sortBy === "duration") {
        return (b.duration_minutes ?? 0) - (a.duration_minutes ?? 0);
      }
      if (sortBy === "calories") {
        return (b.calories ?? 0) - (a.calories ?? 0);
      }
      return 0;
    });
  }, [workouts, searchQuery, filterType, sortBy]);

  const stats = useMemo(() => {
    if (!workouts.length) return null;
    const totalWorkouts = workouts.length;
    const totalCalories = workouts.reduce(
      (sum, w) => sum + (w.calories ?? 0),
      0,
    );
    const totalDuration = workouts.reduce(
      (sum, w) => sum + (w.duration_minutes ?? 0),
      0,
    );
    const avgCalories = Math.round(totalCalories / totalWorkouts);
    const avgDuration = Math.round(totalDuration / totalWorkouts);
    return { totalWorkouts, totalCalories, totalDuration, avgCalories, avgDuration };
  }, [workouts]);

  const workoutTypes = ["all", "strength", "cardio", "flexibility", "hiit", "yoga"];
  const sortOptions = [
    { value: "date", label: "Date" },
    { value: "duration", label: "Duration" },
    { value: "calories", label: "Calories" },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-day-text-primary dark:text-night-text-primary">
            Workout History
          </h1>
          <p className="text-day-text-secondary dark:text-night-text-secondary">
            Track your fitness journey and progress
          </p>
        </div>
        <Link href="/dashboard/workout-planner">
          <Button variant="primary">
            <Play className="mr-2 h-4 w-4" />
            Start Workout
          </Button>
        </Link>
      </motion.div>

      {stats ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 gap-6 md:grid-cols-4"
        >
          <Card className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
              <Play className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
              {stats.totalWorkouts}
            </div>
            <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
              Total Workouts
            </div>
          </Card>

          <Card className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
              <Flame className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
              {stats.totalCalories}
            </div>
            <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
              Calories Burned
            </div>
          </Card>

          <Card className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <Clock className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
              {stats.totalDuration}
            </div>
            <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
              Total Minutes
            </div>
          </Card>

          <Card className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/20">
              <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-day-text-primary dark:text-night-text-primary">
              {stats.avgCalories}
            </div>
            <div className="text-sm text-day-text-secondary dark:text-night-text-secondary">
              Avg Calories/Workout
            </div>
          </Card>
        </motion.div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex flex-col gap-4 md:flex-row"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-day-text-secondary dark:text-night-text-secondary" />
          <input
            type="text"
            placeholder="Search workouts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-day-border bg-day-card py-3 pl-10 pr-4 text-day-text-primary focus:border-transparent focus:ring-2 focus:ring-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:focus:ring-night-accent"
          />
        </div>

        <div className="flex gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-day-border bg-day-card px-4 py-3 text-day-text-primary focus:border-transparent focus:ring-2 focus:ring-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:focus:ring-night-accent"
          >
            {workoutTypes.map((type) => (
              <option key={type} value={type}>
                {type === "all"
                  ? "All Types"
                  : type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-day-border bg-day-card px-4 py-3 text-day-text-primary focus:border-transparent focus:ring-2 focus:ring-day-accent-primary dark:border-night-border dark:bg-night-card dark:text-night-text-primary dark:focus:ring-night-accent"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                Sort by {option.label}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="space-y-4"
      >
        {filteredWorkouts.map((workout) => (
          <Card key={workout.id} className="p-6 hover:shadow-lg">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-day-accent-primary to-day-accent-secondary dark:from-night-accent dark:to-red-600">
                  <Play className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-day-text-primary dark:text-night-text-primary">
                    {workout.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-day-text-secondary dark:text-night-text-secondary">
                    <span className="flex items-center">
                      <Clock className="mr-1 h-4 w-4" />
                      {workout.duration_minutes ?? 0} min
                    </span>
                    <span className="flex items-center">
                      <Flame className="mr-1 h-4 w-4" />
                      {workout.calories ?? 0} cal
                    </span>
                    <span className="flex items-center">
                      <Calendar className="mr-1 h-4 w-4" />
                      {new Date(workout.performed_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant="ghost" size="sm" className="capitalize">
                  {workout.type ?? "workout"}
                </Badge>
                <Link href="/dashboard/workout-planner">
                  <Button variant="ghost" size="sm">
                    <Play className="mr-1 h-4 w-4" />
                    Repeat
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </motion.div>

      {!loading && filteredWorkouts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="py-12 text-center"
        >
          <Play className="mx-auto mb-4 h-16 w-16 text-day-text-secondary dark:text-night-text-secondary" />
          <h3 className="mb-2 text-lg font-medium text-day-text-primary dark:text-night-text-primary">
            {searchQuery || filterType !== "all"
              ? "No workouts found"
              : "No workouts yet"}
          </h3>
          <p className="mb-4 text-day-text-secondary dark:text-night-text-secondary">
            {searchQuery || filterType !== "all"
              ? "Try adjusting your search or filters"
              : "Start your fitness journey with your first workout"}
          </p>
          <Link href="/dashboard/workout-planner">
            <Button variant="primary">
              <Play className="mr-2 h-4 w-4" />
              Start Your First Workout
            </Button>
          </Link>
        </motion.div>
      ) : null}
    </div>
  );
}
