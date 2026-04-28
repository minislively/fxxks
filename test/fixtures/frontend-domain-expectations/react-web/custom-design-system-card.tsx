import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, StatRow } from "@/components/ui";

type BillingPlan = {
  id: string;
  label: string;
  value: string;
};

export interface BillingPlanCardProps {
  title: string;
  description: string;
  highlighted?: boolean;
  plans: BillingPlan[];
  onReviewUsage: (planId: string) => void;
}

export function BillingPlanCard({ title, description, highlighted = false, plans, onReviewUsage }: BillingPlanCardProps) {
  return (
    <Card className={highlighted ? "rounded-xl border-primary bg-card shadow-md" : "rounded-xl border bg-card shadow-sm"}>
      <CardHeader className="space-y-2">
        <Badge className="w-fit">Team</Badge>
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
        <CardDescription className="text-muted-foreground">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {plans.map((plan) => (
          <StatRow key={plan.id} className="rounded-lg border px-3 py-2" label={plan.label} value={plan.value} />
        ))}
        {plans.map((plan) => (
          <Button key={plan.id} className="w-full justify-center" onClick={() => onReviewUsage(plan.id)}>
            Review {plan.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
