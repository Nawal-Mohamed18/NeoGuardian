import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Patient } from "@/types";

export function PatientAIInsights({ patient }: { patient: Patient }) {
  const latest = patient.latest_assessment;
  if (!latest) {
    return (
      <EmptyState
        title="No assessment yet"
        description="Run a new assessment for this newborn to see AI help."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Risk Interpretation</CardTitle></CardHeader>
        <CardContent><p className="text-sm leading-relaxed text-foreground">{latest.ai_summary}</p></CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Life-Saving Interventions</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {latest.ai_recommendations.map((r) => (
                <li key={r} className="text-sm text-muted-foreground">• {r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Complications to Monitor</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {latest.ai_differentials.map((d) => (
                <li key={d} className="text-sm text-muted-foreground">• {d}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
