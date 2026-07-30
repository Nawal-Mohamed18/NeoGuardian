import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, RotateCcw, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MortalityBadge } from "@/components/mortality/MortalityGauge";
import { aiApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ChatMessage, Patient } from "@/types";

interface PatientChatProps {
  patientId: number;
  patientCode: string;
  patient?: Patient;
  assessmentCount?: number;
}

const QUICK_PROMPTS = [
  { label: "Risk drivers", text: "What drives this newborn's risk profile?" },
  { label: "Next hour", text: "What interventions are most urgent in the next hour?" },
  { label: "Watch-fors", text: "What complications could elevate risk?" },
  { label: "Vitals", text: "How should I interpret the latest vitals?" },
];

function MessageBody({ content, role }: { content: string; role: ChatMessage["role"] }) {
  const blocks = content.split(/\n\n+/).filter(Boolean);
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim().length);
        const isList = lines.length > 1 && lines.every((l) => /^[•\-*]/.test(l.trim()));
        if (isList) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-4 text-[13px] leading-relaxed">
              {lines.map((line, j) => (
                <li key={j}>{line.replace(/^[•\-*]\s*/, "")}</li>
              ))}
            </ul>
          );
        }
        return (
          <p
            key={i}
            className={cn(
              "whitespace-pre-wrap text-[13px] leading-relaxed",
              role === "user" && "text-primary-foreground"
            )}
          >
            {block}
          </p>
        );
      })}
    </div>
  );
}

export function PatientChat({
  patientId,
  patientCode,
  patient,
  assessmentCount,
}: PatientChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const latest = patient?.latest_assessment;
  const ga = patient?.gestational_age;
  const count = assessmentCount ?? 0;
  const isFirstAssessment = count <= 1;
  const birthWeight = patient?.birth_weight;
  const currentWeight =
    patient?.current_weight ?? latest?.current_weight ?? birthWeight;
  const weight = isFirstAssessment ? birthWeight : currentWeight;
  const weightLabel = isFirstAssessment ? "Birth" : "Current";

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);
    try {
      const res = await aiApi.chat(patientId, trimmed, messages);
      setModelUsed(res.model_used);
      setMessages([...updated, { role: "assistant", content: res.reply }]);
    } catch {
      setMessages([
        ...updated,
        {
          role: "assistant",
          content:
            "I could not reach the clinical chat service. Check your connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    setMessages([]);
    setModelUsed(null);
    setInput("");
  }, [patientId]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  return (
    <div className="flex h-[min(70vh,560px)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex items-start justify-between gap-3 border-b border-border/80 bg-linear-to-r from-teal-500/10 via-card to-sky-500/5 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">Clinical AI Chat</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Bedside guidance from this newborn’s latest assessment
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {latest ? (
                <MortalityBadge
                  tier={latest.mortality_tier}
                  probability={latest.mortality_probability}
                  className="whitespace-nowrap"
                />
              ) : null}
              {ga != null ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {ga}w
                </span>
              ) : null}
              {weight != null ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {weightLabel} {weight} kg
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {messages.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground"
            onClick={() => {
              setMessages([]);
              setModelUsed(null);
            }}
            aria-label="Clear chat"
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && !loading ? (
            <div className="mx-auto flex max-w-lg flex-col items-center py-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-700 dark:text-teal-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">Ask about this baby’s risk plan</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Answers use the saved model score, drivers, and vitals — not a diagnosis.
              </p>
              <div className="mt-5 flex w-full flex-wrap justify-center gap-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => void send(q.text)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[min(100%,28rem)] rounded-2xl px-3.5 py-2.5 shadow-sm",
                  m.role === "user"
                    ? "rounded-br-md bg-teal-600 text-white"
                    : "rounded-bl-md border border-border/70 bg-muted/60 text-foreground"
                )}
              >
                <MessageBody content={m.content} role={m.role} />
              </div>
            </div>
          ))}

          {loading ? (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border/70 bg-muted/60 px-3.5 py-2.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-600" />
                Reviewing chart context…
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border bg-card/95 px-3 py-3">
          {messages.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  disabled={loading}
                  onClick={() => void send(q.text)}
                  className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition hover:bg-teal-50 hover:text-teal-800 disabled:opacity-50 dark:hover:bg-teal-950/40 dark:hover:text-teal-200"
                >
                  {q.label}
                </button>
              ))}
            </div>
          ) : null}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              disabled={loading}
              placeholder="Ask about risk, actions, vitals…"
              aria-label="Clinical chat message"
              className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none ring-teal-500/30 placeholder:text-muted-foreground focus:ring-2 disabled:opacity-60"
            />
            <Button
              type="submit"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl"
              disabled={loading || !input.trim()}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
            Decision support only — verify clinically.
            {modelUsed ? (
              <span className="ml-1 opacity-80">
                ·{" "}
                {modelUsed.includes("local") || modelUsed === "fallback"
                  ? "Chart-based replies"
                  : `Model: ${modelUsed}`}
              </span>
            ) : null}
            <span className="sr-only"> Patient {patientCode}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
