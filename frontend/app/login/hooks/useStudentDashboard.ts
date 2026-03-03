import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type TopicMastery = {
  id: string;
  name: string;
  moduleId?: string | number;
  masteryPercent: number;
};

export type RecentActivityItem = {
  id: string;
  type: "quiz" | "reading" | "video" | "module";
  label: string;
  moduleId?: string | number;
  timestamp: string;
  durationMinutes?: number;
  masteryChange?: number;
};

export type StudentDashboardSnapshot = {
  overallMastery: number;
  totalTimeMinutes: number;
  activeStreakDays?: number;
  topics: TopicMastery[];
  recentActivity: RecentActivityItem[];
};

type UseStudentDashboardState = {
  data: StudentDashboardSnapshot | null;
  loading: boolean;
  error: string | null;
};

const POLL_INTERVAL_MS = 15000;

export function useStudentDashboard(): UseStudentDashboardState {
  const { token } = useAuth();
  const [state, setState] = useState<UseStudentDashboardState>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    const fetchSnapshot = async () => {
      if (!token) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: null,
        }));
        return;
      }

      setState((prev) => ({ ...prev, loading: prev.data === null, error: null }));

      try {
        const response = await fetch(`${API_URL}/student/dashboard`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          // Do not hard-fail the UI for non-200; just surface a soft error
          const text = await response.text().catch(() => "");
          if (cancelled) return;
          setState((prev) => ({
            ...prev,
            loading: false,
            error: text || `Unable to load dashboard data (status ${response.status}).`,
          }));
          return;
        }

        const raw = await response.json();

        const normalized: StudentDashboardSnapshot = {
          overallMastery: Number(raw?.overallMastery ?? raw?.overall_mastery ?? 0),
          totalTimeMinutes: Number(
            raw?.totalTimeMinutes ??
              raw?.total_time_minutes ??
              raw?.total_time_spent_minutes ??
              0,
          ),
          activeStreakDays: raw?.activeStreakDays ?? raw?.active_streak_days,
          topics: Array.isArray(raw?.topics)
            ? raw.topics.map((t: any, index: number): TopicMastery => ({
                id: String(t.id ?? t.topicId ?? index),
                name: String(t.name ?? t.topic_name ?? t.topic ?? `Topic ${index + 1}`),
                moduleId: t.moduleId ?? t.module_id,
                masteryPercent: Number(t.masteryPercent ?? t.mastery_percent ?? t.mastery ?? 0),
              }))
            : [],
          recentActivity: Array.isArray(raw?.recentActivity ?? raw?.recent_activity)
            ? (raw.recentActivity ?? raw.recent_activity).map(
                (item: any, index: number): RecentActivityItem => ({
                  id: String(item.id ?? index),
                  type:
                    item.type === "reading" ||
                    item.type === "video" ||
                    item.type === "module" ||
                    item.type === "quiz"
                      ? item.type
                      : "module",
                  label: String(item.label ?? item.description ?? "Activity"),
                  moduleId: item.moduleId ?? item.module_id,
                  timestamp: String(item.timestamp ?? item.time ?? new Date().toISOString()),
                  durationMinutes: item.durationMinutes ?? item.duration_minutes,
                  masteryChange: item.masteryChange ?? item.mastery_change,
                }),
              )
            : [],
        };

        if (cancelled) return;
        setState({ data: normalized, loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            err instanceof Error
              ? err.message
              : "Unexpected error while loading dashboard data.",
        }));
      }
    };

    // Initial fetch
    void fetchSnapshot();

    // Lightweight polling to keep dashboard fresh
    intervalId = window.setInterval(fetchSnapshot, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [token]);

  return state;
}

