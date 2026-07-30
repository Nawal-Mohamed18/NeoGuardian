import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link, useSearchParams, Navigate } from "react-router-dom";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ArrowLeft, ArrowRight } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageLoading } from "@/components/shared/PageLoading";
import { AiAnalysisOverlay, withAiAnalysisExperience } from "@/components/ai/AiAnalysisOverlay";
import { AiResultsReveal } from "@/components/ai/AiResultsReveal";
import { ApgarCalculator } from "@/components/clinical/ApgarCalculator";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateAssessment } from "@/hooks/useAssessments";
import { usePatient } from "@/hooks/usePatients";
import {
  assessmentSchema,
  toAssessmentPayload,
  type AssessmentFormValues,
} from "@/lib/schemas/assessment";
import { emptyApgarComponents, isApgarComplete, sumApgar, type ApgarComponents, type ApgarScoreValue } from "@/lib/apgar";
import type { Assessment } from "@/types";

const NEW_STEPS = ["Identity", "Demographics", "Clinical Care", "Risk Tier"];

function asApgarComponents(
  value: AssessmentFormValues["apgar_1min_components"]
): ApgarComponents {
  if (value && typeof value === "object") {
    const read = (k: keyof ApgarComponents): ApgarScoreValue => {
      const raw = (value as Record<string, unknown>)[k];
      if (raw === null || raw === undefined || raw === "") return null;
      const n = Number(raw);
      if (n === 0 || n === 1 || n === 2) return n;
      return null;
    };
    return {
      appearance: read("appearance"),
      pulse: read("pulse"),
      grimace: read("grimace"),
      activity: read("activity"),
      respiration: read("respiration"),
    };
  }
  return emptyApgarComponents();
}

export default function AssessmentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientIdParam = searchParams.get("patient");
  const patientId = patientIdParam ? Number(patientIdParam) : undefined;
  const isReassess = Number.isFinite(patientId) && (patientId as number) > 0;

  const { data: patient, isLoading: patientLoading, isError: patientError } = usePatient(
    isReassess ? patientId : undefined
  );

  const [step, setStep] = useState(0);
  const [result, setResult] = useState<Assessment | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const mutation = useCreateAssessment();

  const form = useForm<AssessmentFormValues>({
    resolver: zodResolver(assessmentSchema) as Resolver<AssessmentFormValues>,
    defaultValues: {
      patient_code: "",
      gender: undefined,
      mother_age: undefined,
      birth_weight: undefined,
      gestational_age: undefined,
      sepsis: false,
      respiratory_distress_grade: "None",
      birth_asphyxia_grade: "None",
      respiratory_distress_syndrome: false,
      birth_asphyxia: false,
      multiple_birth: false,
      apgar_1min_components: emptyApgarComponents(),
      apgar_5min_components: emptyApgarComponents(),
      apgar_1min: 0,
      apgar_5min: 0,
    },
  });

  const {
    register,
    handleSubmit,
    trigger,
    reset,
    formState: { errors },
    getValues,
    setError,
    setValue,
    watch,
  } = form;

  const watchedTemperature = watch("temperature");
  const watchedHeartRate = watch("heart_rate");
  const watchedSpo2 = watch("spo2");
  const watchedRr = watch("respiratory_rate");
  const watchedGlucose = watch("blood_glucose");
  const watchedApgar1 = watch("apgar_1min_components");
  const watchedApgar5 = watch("apgar_5min_components");

  useEffect(() => {
    if (!patient) return;
    const latest = patient.latest_assessment;
    const maternal = patient.maternal;
    reset({
      patient_code: patient.patient_code,
      gender: (patient.gender === "Male" || patient.gender === "Female"
        ? patient.gender
        : patient.gender?.toLowerCase().startsWith("m")
          ? "Male"
          : "Female") as "Male" | "Female",
      mother_age: maternal?.age ?? patient.mother_age,
      birth_weight: patient.birth_weight,
      current_weight:
        patient.current_weight ??
        latest?.current_weight ??
        latest?.birth_weight ??
        patient.birth_weight,
      gestational_age: patient.gestational_age,
      apgar_1min: patient.apgar_1min ?? latest?.apgar_1min ?? undefined,
      apgar_5min: patient.apgar_5min ?? latest?.apgar_5min ?? undefined,
      apgar_1min_components: patient.apgar_1min_components ?? null,
      apgar_5min_components: patient.apgar_5min_components ?? null,
      temperature: latest?.temperature ?? undefined,
      heart_rate: latest?.heart_rate ?? undefined,
      spo2: latest?.spo2 ?? undefined,
      respiratory_rate: latest?.respiratory_rate ?? undefined,
      blood_glucose: latest?.blood_glucose ?? undefined,
      sepsis: latest?.sepsis ?? false,
      respiratory_distress_grade:
        (latest?.respiratory_distress_grade as AssessmentFormValues["respiratory_distress_grade"]) ||
        (latest?.respiratory_distress_syndrome ? "Moderate" : "None"),
      birth_asphyxia_grade:
        (latest?.birth_asphyxia_grade as AssessmentFormValues["birth_asphyxia_grade"]) ||
        (latest?.birth_asphyxia ? "Moderate" : "None"),
      respiratory_distress_syndrome: latest?.respiratory_distress_syndrome ?? false,
      birth_asphyxia: latest?.birth_asphyxia ?? false,
      multiple_birth: latest?.multiple_birth ?? false,
    });
    setStep(0);
    setResult(null);
  }, [patient, reset]);

  const steps = useMemo(() => (isReassess ? [] : NEW_STEPS), [isReassess]);

  const nextStep = async () => {
    if (isReassess) return;
    const fields: (keyof AssessmentFormValues)[][] = [
      ["patient_code", "gender", "mother_age"],
      ["birth_weight", "gestational_age"],
      ["temperature", "heart_rate", "spo2", "blood_glucose"],
    ];
    if (step < 2) {
      const valid = await trigger(fields[step]);
      if (!valid) return;
      if (step === 1) {
        const a1 = asApgarComponents(getValues("apgar_1min_components"));
        const a5 = asApgarComponents(getValues("apgar_5min_components"));
        if (!isApgarComplete(a1)) {
          setError("apgar_1min", { message: "Score all five letters for the 1-minute Apgar." });
          return;
        }
        if (!isApgarComplete(a5)) {
          setError("apgar_5min", { message: "Score all five letters for the 5-minute Apgar." });
          return;
        }
      }
      setStep((s) => s + 1);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    if (isReassess) {
      const cw = values.current_weight;
      if (cw == null || Number.isNaN(Number(cw))) {
        setError("current_weight", { message: "Current weight is required for re-assessment." });
        return;
      }
      if (Number(cw) < 0.3 || Number(cw) > 8) {
        setError("current_weight", {
          message: "Current weight must be between 0.3 and 8.0 kg (no negative values).",
        });
        return;
      }
      const requiredBedside: {
        key: keyof AssessmentFormValues;
        label: string;
      }[] = [
        { key: "temperature", label: "Temperature" },
        { key: "heart_rate", label: "Heart rate" },
        { key: "spo2", label: "SpO₂" },
        { key: "respiratory_rate", label: "Respiratory rate" },
        { key: "blood_glucose", label: "Blood glucose" },
      ];
      let missing = false;
      for (const field of requiredBedside) {
        const v = values[field.key];
        if (v == null || v === "" || (typeof v === "number" && Number.isNaN(v))) {
          setError(field.key, { message: `${field.label} is required for re-assessment.` });
          missing = true;
        }
      }
      if (missing) return;
    }
    setAnalyzing(true);
    try {
      const payload = toAssessmentPayload(values);
      const res = await withAiAnalysisExperience(() => mutation.mutateAsync(payload));
      if (isReassess) {
        navigate(`/newborns/${patientId}`, { replace: true });
        return;
      }
      setResult(res);
      setStep(3);
    } finally {
      setAnalyzing(false);
    }
  });

  const analyzingVitals = {
    temperature: getValues("temperature"),
    heart_rate: getValues("heart_rate"),
    spo2: getValues("spo2"),
    respiratory_rate: getValues("respiratory_rate"),
    sepsis: getValues("sepsis"),
    respiratory_distress_syndrome: getValues("respiratory_distress_grade") !== "None",
    birth_asphyxia: getValues("birth_asphyxia_grade") !== "None",
  };

  const clinicalSnapshot = {
    temperature: watchedTemperature,
    heart_rate: watchedHeartRate,
    spo2: watchedSpo2,
    respiratory_rate: watchedRr,
    blood_glucose: watchedGlucose,
  };

  // Clinical workflow: assessments API is reassess-only. New babies use Admit Newborn.
  if (!isReassess) {
    return <Navigate to="/my-patients" replace />;
  }

  if (patientLoading) {
    return (
      <AppLayout>
        <PageLoading />
      </AppLayout>
    );
  }

  if (patientError || !patient) {
    return (
      <AppLayout>
        <PageHeader title="Re-assess" description="Patient not found." />
        <Button asChild variant="outline">
          <Link to="/newborns">Back to patients</Link>
        </Button>
      </AppLayout>
    );
  }

  const resultStep = 3;
  const clinicalStep = isReassess ? 0 : 2;
  const showResult = result != null;
  const showForm = !showResult && (isReassess || step < resultStep);
  const showResultPanel = showResult;

  return (
    <AppLayout>
      <AiAnalysisOverlay
        open={analyzing}
        title={isReassess ? "Updating risk" : "Running AI assessment"}
        subtitle={
          isReassess
            ? patient!.patient_code
            : "Computing 28-day neonatal mortality risk"
        }
        vitals={analyzing ? analyzingVitals : null}
      />

      <PageHeader
        title={isReassess ? "Re-assess" : "New Assessment"}
        description={
          isReassess
            ? patient!.patient_code
            : "NICU admission assessment"
        }
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link to={isReassess ? `/newborns/${patient!.id}` : "/newborns"}>
              <ArrowLeft className="h-4 w-4" /> {isReassess ? "Patient" : "Patients"}
            </Link>
          </Button>
        }
      />

      <div className="w-full">
        {!isReassess && steps.length > 0 ? (
          <div className="mb-8 flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s} className="flex flex-1 items-center gap-2">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    i < step
                      ? "bg-primary text-primary-foreground"
                      : i === step
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={`hidden text-xs sm:block ${i === step ? "font-medium" : "text-muted-foreground"}`}>
                  {s}
                </span>
                {i < steps.length - 1 && (
                  <div className={`h-px flex-1 ${i < step ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
        ) : null}

        <Card className="w-full">
          <CardContent className="p-6">
            {isReassess && showForm && patient && (
              <div className="mb-5">
                <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
                  <p className="font-semibold text-foreground">
                    {patient.display_name || patient.patient_code}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {patient.patient_code}
                    {" · "}
                    {patient.gender}
                    {patient.pod_name ? ` · ${patient.pod_name}` : ""}
                    {patient.bed_number ? ` · Bed ${patient.bed_number}` : ""}
                  </p>
                </div>
              </div>
            )}

            {!isReassess && step === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label title="PatientCode">Patient code *</Label>
                  <Input {...register("patient_code")} placeholder="NB-3001" className="mt-1.5" />
                  {errors.patient_code && (
                    <p className="mt-1 text-xs text-destructive">{errors.patient_code.message}</p>
                  )}
                </div>
                <div>
                  <Label title="Sex">Sex *</Label>
                  <select
                    {...register("gender")}
                    className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  {errors.gender && (
                    <p className="mt-1 text-xs text-destructive">{errors.gender.message}</p>
                  )}
                </div>
                <div>
                  <Label title="MotherAge">Mother age at delivery *</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 28"
                    {...register("mother_age")}
                    className="mt-1.5"
                  />
                  {errors.mother_age && (
                    <p className="mt-1 text-xs text-destructive">{errors.mother_age.message}</p>
                  )}
                </div>
              </div>
            )}

            {!isReassess && step === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label title="BirthWeight_kg">Birth weight (kg) *</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 2.5"
                    {...register("birth_weight")}
                    className="mt-1.5"
                  />
                  {errors.birth_weight && (
                    <p className="mt-1 text-xs text-destructive">{errors.birth_weight.message}</p>
                  )}
                </div>
                <div>
                  <Label title="GestationalAge_weeks">Gestational age (weeks) *</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 37"
                    {...register("gestational_age")}
                    className="mt-1.5"
                  />
                  {errors.gestational_age && (
                    <p className="mt-1 text-xs text-destructive">{errors.gestational_age.message}</p>
                  )}
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <ApgarCalculator
                    label="Apgar score — 1 minute"
                    value={asApgarComponents(watchedApgar1)}
                    onChange={(next) => {
                      setValue("apgar_1min_components", next, { shouldDirty: true });
                      setValue("apgar_1min", sumApgar(next) ?? undefined, { shouldValidate: true });
                    }}
                  />
                  {errors.apgar_1min && (
                    <p className="text-xs text-destructive">{errors.apgar_1min.message}</p>
                  )}
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <ApgarCalculator
                    label="Apgar score — 5 minutes"
                    value={asApgarComponents(watchedApgar5)}
                    onChange={(next) => {
                      setValue("apgar_5min_components", next, { shouldDirty: true });
                      setValue("apgar_5min", sumApgar(next) ?? undefined, { shouldValidate: true });
                    }}
                  />
                  {errors.apgar_5min && (
                    <p className="text-xs text-destructive">{errors.apgar_5min.message}</p>
                  )}
                </div>
              </div>
            )}

            {showForm && step === clinicalStep && (
              <div className="space-y-4">
                {isReassess ? (
                  <>
                    <div>
                      <Label title="CurrentWeight_kg">Current weight (kg) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0.3}
                        max={8}
                        placeholder="e.g. 2.2"
                        {...register("current_weight", {
                          valueAsNumber: true,
                          min: { value: 0.3, message: "Current weight must be at least 0.3 kg" },
                          max: { value: 8, message: "Current weight must be at most 8.0 kg" },
                        })}
                        className="mt-1.5"
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Required for re-assessment. Used with weight-change % (vs admission birth weight).
                      </p>
                      {errors.current_weight && (
                        <p className="mt-1 text-xs text-destructive">{errors.current_weight.message}</p>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label title="Temperature_C">Temperature (°C) *</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="e.g. 36.5"
                          {...register("temperature")}
                          className="mt-1.5"
                        />
                        {errors.temperature && (
                          <p className="mt-1 text-xs text-destructive">{errors.temperature.message}</p>
                        )}
                      </div>
                      <div>
                        <Label title="HeartRate">Heart rate (bpm) *</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 140"
                          {...register("heart_rate")}
                          className="mt-1.5"
                        />
                        {errors.heart_rate && (
                          <p className="mt-1 text-xs text-destructive">{errors.heart_rate.message}</p>
                        )}
                      </div>
                      <div>
                        <Label title="SpO2">SpO₂ (%) *</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 98"
                          {...register("spo2")}
                          className="mt-1.5"
                        />
                        {errors.spo2 && (
                          <p className="mt-1 text-xs text-destructive">{errors.spo2.message}</p>
                        )}
                      </div>
                      <div>
                        <Label title="RespiratoryRate">Respiratory rate (/min) *</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 45"
                          {...register("respiratory_rate")}
                          className="mt-1.5"
                        />
                        {errors.respiratory_rate && (
                          <p className="mt-1 text-xs text-destructive">{errors.respiratory_rate.message}</p>
                        )}
                      </div>
                      <div>
                        <Label title="BloodGlucose_mg_dL">Blood glucose (mg/dL) *</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 70"
                          min={10}
                          max={600}
                          {...register("blood_glucose")}
                          className="mt-1.5"
                        />
                        {errors.blood_glucose && (
                          <p className="mt-1 text-xs text-destructive">{errors.blood_glucose.message}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>RDS severity</Label>
                        <select
                          {...register("respiratory_distress_grade")}
                          className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                        >
                          <option value="None">None</option>
                          <option value="Mild">Mild</option>
                          <option value="Moderate">Moderate</option>
                          <option value="Severe">Severe</option>
                        </select>
                      </div>
                      <div>
                        <Label>Birth asphyxia severity</Label>
                        <select
                          {...register("birth_asphyxia_grade")}
                          className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                        >
                          <option value="None">None</option>
                          <option value="Mild">Mild</option>
                          <option value="Moderate">Moderate</option>
                          <option value="Severe">Severe</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-sm sm:col-span-2">
                        <input type="checkbox" {...register("sepsis")} /> Suspected sepsis
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label title="Temperature_C">Temperature (°C)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="e.g. 36.5"
                          {...register("temperature")}
                          className="mt-1.5"
                        />
                        {errors.temperature && (
                          <p className="mt-1 text-xs text-destructive">{errors.temperature.message}</p>
                        )}
                      </div>
                      <div>
                        <Label title="HeartRate">Heart rate (bpm)</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 140"
                          {...register("heart_rate")}
                          className="mt-1.5"
                        />
                        {errors.heart_rate && (
                          <p className="mt-1 text-xs text-destructive">{errors.heart_rate.message}</p>
                        )}
                      </div>
                      <div>
                        <Label title="SpO2">SpO₂ (%)</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 98"
                          {...register("spo2")}
                          className="mt-1.5"
                        />
                        {errors.spo2 && (
                          <p className="mt-1 text-xs text-destructive">{errors.spo2.message}</p>
                        )}
                      </div>
                      <div>
                        <Label title="RespiratoryRate">Respiratory rate (/min)</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 45"
                          {...register("respiratory_rate")}
                          className="mt-1.5"
                        />
                        {errors.respiratory_rate && (
                          <p className="mt-1 text-xs text-destructive">{errors.respiratory_rate.message}</p>
                        )}
                      </div>
                      <div>
                        <Label title="BloodGlucose_mg_dL">Blood glucose (mg/dL) *</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 70"
                          min={10}
                          max={600}
                          {...register("blood_glucose")}
                          className="mt-1.5"
                        />
                        {errors.blood_glucose && (
                          <p className="mt-1 text-xs text-destructive">{errors.blood_glucose.message}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>RDS severity</Label>
                        <select
                          {...register("respiratory_distress_grade")}
                          className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                        >
                          <option value="None">None</option>
                          <option value="Mild">Mild</option>
                          <option value="Moderate">Moderate</option>
                          <option value="Severe">Severe</option>
                        </select>
                      </div>
                      <div>
                        <Label>Birth asphyxia severity</Label>
                        <select
                          {...register("birth_asphyxia_grade")}
                          className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                        >
                          <option value="None">None</option>
                          <option value="Mild">Mild</option>
                          <option value="Moderate">Moderate</option>
                          <option value="Severe">Severe</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-sm sm:col-span-2">
                        <input type="checkbox" {...register("multiple_birth")} /> Multiple birth
                      </label>
                      <label className="flex items-center gap-2 text-sm sm:col-span-2">
                        <input type="checkbox" {...register("sepsis")} /> Suspected sepsis
                      </label>
                    </div>
                  </>
                )}
                {mutation.isError && (
                  <p className="text-sm text-destructive">Assessment failed — check login and try again.</p>
                )}
              </div>
            )}

            {showResultPanel && result && (
              <AiResultsReveal
                result={result}
                patientCode={getValues("patient_code") || result.patient_code}
                clinicalSnapshot={{
                  temperature: getValues("temperature"),
                  heart_rate: getValues("heart_rate"),
                  spo2: getValues("spo2"),
                  respiratory_rate: getValues("respiratory_rate"),
                  blood_glucose: getValues("blood_glucose"),
                }}
                onOpenChart={() => navigate(`/newborns/${result.patient ?? patientId}`)}
                openChartLabel={isReassess ? "Back to patient chart" : "Open Clinical Profile"}
              />
            )}

            {showForm && (
              <div className="mt-6 flex justify-between border-t border-border pt-4">
                <Button
                  variant="outline"
                  onClick={() => setStep((s) => s - 1)}
                  disabled={step === 0 || isReassess || analyzing}
                >
                  Back
                </Button>
                {!isReassess && step < clinicalStep ? (
                  <Button onClick={nextStep} disabled={analyzing}>
                    Next <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={onSubmit} disabled={analyzing || mutation.isPending}>
                    {analyzing
                      ? "Analyzing…"
                      : isReassess
                        ? "Update risk"
                        : "Run Assessment"}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
