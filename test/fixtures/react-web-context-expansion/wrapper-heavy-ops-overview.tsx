import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, MetricTile, SectionHeading, Stack, Toolbar } from "@/components/ui";

export interface OperationsOverviewShellProps {
  hasBlockingSyncs?: boolean;
  onAcknowledgeRisk: () => void;
  onOpenRunbook: () => void;
  onRetrySync: () => void;
}

export function OperationsOverviewShell({
  hasBlockingSyncs = false,
  onAcknowledgeRisk,
  onOpenRunbook,
  onRetrySync,
}: OperationsOverviewShellProps) {
  return (
    <Card className={hasBlockingSyncs ? "rounded-3xl border-amber-300 bg-amber-50 shadow-sm" : "rounded-3xl border-slate-200 bg-white shadow-sm"}>
      <CardHeader className="space-y-3">
        <SectionHeading className="text-xs font-semibold uppercase tracking-wide text-sky-600">Operations readiness</SectionHeading>
        <Stack className="gap-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-xl font-semibold text-slate-900">Daily control room</CardTitle>
            <Badge className="rounded-full px-2 py-1 text-xs font-medium" variant={hasBlockingSyncs ? "warning" : "success"}>
              {hasBlockingSyncs ? "Needs attention" : "Healthy"}
            </Badge>
          </div>
          <CardDescription className="text-sm text-slate-600">
            Keep queue health, release messaging, and incident-response ownership visible in one wrapper-heavy shell.
          </CardDescription>
        </Stack>
      </CardHeader>

      <CardContent className="space-y-5">
        <Toolbar className="grid gap-3 md:grid-cols-3">
          <MetricTile className="rounded-2xl border px-4 py-3" label="Escalations" value="3" tone={hasBlockingSyncs ? "warning" : "neutral"} />
          <MetricTile className="rounded-2xl border px-4 py-3" label="Queued releases" value="5" tone="neutral" />
          <MetricTile className="rounded-2xl border px-4 py-3" label="Owner coverage" value="92%" tone="success" />
        </Toolbar>

        <Stack className="gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <Button className="justify-start" variant="ghost" onClick={onOpenRunbook}>
            Open runbook
          </Button>
          <Button className="justify-start" variant="outline" onClick={onRetrySync}>
            Retry sync
          </Button>
          <Button className="justify-start" variant="secondary" onClick={onAcknowledgeRisk}>
            Acknowledge risk
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
