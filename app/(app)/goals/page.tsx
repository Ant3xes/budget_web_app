import { GoalsList } from "@/components/goals/goals-list";
import { T } from "@/components/i18n/t";

export default function GoalsPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">
        <T k="goals.title" />
      </h1>
      <GoalsList />
    </section>
  );
}
