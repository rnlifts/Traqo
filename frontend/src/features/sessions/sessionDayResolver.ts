import type { WorkoutPlanDetail, PlanDay } from "../../api/workoutPlansApi";

/**
 * Resolves a session day from a plan detail object, handling both
 * days-type and weeks-type plans. Returns the matching day and a label.
 *
 * For weeks-type plans, the label includes the week number: "Week N · {day.label}"
 * For days-type plans, the label is just the day's label.
 */
export function resolveSessionDay(
  planDetail: WorkoutPlanDetail,
  planDayId: number | null
): { matchingDay: PlanDay | null; dayLabel: string } {
  // Find the matching day from the plan
  // For weeks-type plans, search within weeks; for days-type plans, search top-level days
  let matchingDay: PlanDay | null = null;

  if (planDetail.days && planDetail.days.length > 0) {
    matchingDay = planDetail.days.find((d) => d.id === planDayId) || null;
  } else if (planDetail.weeks && planDetail.weeks.length > 0) {
    for (const week of planDetail.weeks) {
      const found = week.days?.find((d) => d.id === planDayId);
      if (found) {
        matchingDay = found;
        break;
      }
    }
  }

  // Build day label based on unit type
  let dayLabel = matchingDay?.label || "Unknown Day";
  if (planDetail.plan.unit_type === "weeks" && planDetail.weeks && matchingDay) {
    // Find which week contains this day
    for (const week of planDetail.weeks) {
      const dayInWeek = week.days?.find((d) => d.id === matchingDay.id);
      if (dayInWeek) {
        dayLabel = `Week ${week.week_number} · ${dayInWeek.label}`;
        break;
      }
    }
  }

  return { matchingDay, dayLabel };
}
