import { GoalsList } from "@/components/goals/goals-list";

export default function GoalsPage() {
  return (
    <section className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Objectifs d&apos;épargne</h1>
      <GoalsList />
    </section>
  );
}
