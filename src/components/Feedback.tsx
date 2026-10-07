import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  Bug,
  CheckCircle2,
  CircleHelp,
  Lightbulb,
  MessageSquare,
  Send,
  Sparkles,
} from "lucide-react";

type FeedbackType = "bug" | "feature" | "improvement" | "general" | "question";
type FormValues = Record<string, string>;

const feedbackTypes: Array<{ value: FeedbackType; label: string; icon: typeof Bug }> = [
  { value: "bug", label: "Bug report", icon: Bug },
  { value: "feature", label: "Feature request", icon: Lightbulb },
  { value: "improvement", label: "Improvement", icon: Sparkles },
  { value: "general", label: "General feedback", icon: MessageSquare },
  { value: "question", label: "Question / help", icon: CircleHelp },
];

const detailFields: Record<Exclude<FeedbackType, "general">, Array<{ name: string; label: string; placeholder: string }>> = {
  bug: [
    { name: "what_happened", label: "What happened?", placeholder: "Tell us what went wrong." },
    { name: "expected_behavior", label: "Expected behavior", placeholder: "What did you expect to happen?" },
    { name: "steps_to_reproduce", label: "Steps to reproduce", placeholder: "1. Open... 2. Click... 3. Notice..." },
    { name: "device", label: "Device", placeholder: "For example, MacBook Pro 14-inch" },
    { name: "os", label: "Operating system", placeholder: "For example, macOS 15.1" },
    { name: "origin_version", label: "Origin version", placeholder: "For example, 1.0.0" },
  ],
  feature: [
    { name: "request", label: "What would you like Origin to do?", placeholder: "Describe the feature you have in mind." },
    { name: "usefulness", label: "Why would this feature be useful?", placeholder: "Tell us about the workflow it would improve." },
  ],
  improvement: [
    { name: "could_be_improved", label: "What could be improved?", placeholder: "Point us to the part of Origin you have in mind." },
    { name: "how_should_work", label: "How should it work instead?", placeholder: "Describe the experience you would prefer." },
  ],
  question: [
    { name: "trying_to_do", label: "What are you trying to do?", placeholder: "Tell us what you are working on." },
    { name: "problem_facing", label: "What problem are you facing?", placeholder: "Include any details that might help us answer." },
  ],
};

const initialValues: FormValues = { type: "bug", title: "", description: "", email: "", website: "" };

function Field({
  name, label, value, onChange, placeholder, multiline = false, maxLength, error,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  maxLength?: number;
  error?: string;
}) {
  const common = {
    id: name,
    name,
    value,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
    placeholder,
    maxLength,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? `${name}-error` : undefined,
    className: "w-full rounded-lg border border-border-default bg-canvas px-3.5 py-3 text-sm text-primary outline-none transition-colors placeholder:text-tertiary focus:border-accent focus:ring-2 focus:ring-accent/20",
  };

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={name} className="text-sm font-medium text-primary">{label}</label>
        {maxLength && <span className="text-xs text-tertiary">{value.length}/{maxLength}</span>}
      </div>
      {multiline ? <textarea {...common} rows={4} /> : <input {...common} />}
      {error && <p id={`${name}-error`} className="mt-1.5 text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}

export default function Feedback() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [serverError, setServerError] = useState("");
  const type = values.type as FeedbackType;
  const update = (name: string, value: string) => setValues((current) => ({ ...current, [name]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("submitting");
    setErrors({});
    setServerError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json() as { ok: boolean; error?: string; fieldErrors?: Record<string, string> };
      if (!response.ok || !result.ok) {
        setErrors(result.fieldErrors ?? {});
        setServerError(result.error ?? "We could not send that feedback. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setServerError("We could not reach Origin. Check your connection and try again.");
      setStatus("error");
    }
  };

  const reset = () => {
    setValues(initialValues);
    setErrors({});
    setServerError("");
    setStatus("idle");
  };

  return (
    <section className="relative overflow-hidden px-5 pb-24 pt-32 sm:px-8 sm:pb-32 sm:pt-40">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] bg-grid opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="mx-auto grid max-w-[1120px] gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
        <div className="lg:pt-8">
          <p className="mb-4 text-sm font-medium text-accent">Feedback &amp; support</p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-primary sm:text-5xl">Help shape what Origin becomes.</h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-secondary">Found a bug, have an idea, or need a hand? Every note goes straight to the Origin team.</p>
          <div className="mt-10 flex items-center gap-3 text-sm text-tertiary"><Send size={16} aria-hidden="true" /> Thoughtful feedback makes a better workspace.</div>
        </div>

        {status === "success" ? (
          <div className="flex min-h-[460px] flex-col justify-center rounded-xl border border-border-subtle bg-surface p-7 sm:p-10" role="status">
            <CheckCircle2 size={34} className="text-success" aria-hidden="true" />
            <h2 className="mt-6 text-2xl font-semibold text-primary">Thanks for helping improve Origin.</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary">Your feedback was received.{values.email && " We may contact you if we need more information."}</p>
            <button type="button" onClick={reset} className="mt-8 w-fit rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/50">Send another response</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="rounded-xl border border-border-subtle bg-surface p-5 shadow-modal sm:p-8">
            <fieldset disabled={status === "submitting"}>
              <legend className="sr-only">Feedback details</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {feedbackTypes.map(({ value, label, icon: Icon }) => (
                  <button key={value} type="button" onClick={() => update("type", value)} className={`flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-lg border px-2 py-3 text-center text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 ${type === value ? "border-accent bg-accent-muted text-accent-strong" : "border-border-default text-secondary hover:bg-hover hover:text-primary"}`} aria-pressed={type === value}>
                    <Icon size={17} aria-hidden="true" />{label}
                  </button>
                ))}
              </div>
              <div className="mt-8 grid gap-6">
                <Field name="title" label="Title" value={values.title} onChange={(value) => update("title", value)} placeholder="A short summary" maxLength={120} error={errors.title} />
                <Field name="description" label="Description" value={values.description} onChange={(value) => update("description", value)} placeholder="Share the details..." multiline maxLength={4000} error={errors.description} />
                <Field name="email" label="Email (optional)" value={values.email} onChange={(value) => update("email", value)} placeholder="you@example.com" maxLength={254} error={errors.email} />
                {type !== "general" && detailFields[type].map((field) => <Field key={field.name} {...field} value={values[field.name] ?? ""} onChange={(value) => update(field.name, value)} maxLength={2000} error={errors[field.name]} multiline={field.name.includes("steps") || field.name.includes("behavior") || field.name.includes("useful") || field.name.includes("improved") || field.name.includes("instead") || field.name.includes("facing")} />)}
                <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={(event) => update("website", event.target.value)} /></div>
              </div>
              {serverError && <p className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger" role="alert">{serverError}</p>}
              <button type="submit" disabled={status === "submitting"} className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:cursor-wait disabled:opacity-60"><Send size={16} aria-hidden="true" />{status === "submitting" ? "Sending..." : "Send feedback"}</button>
              <p className="mt-4 text-center text-xs text-tertiary">Please do not include passwords, tokens, or other sensitive information.</p>
            </fieldset>
          </form>
        )}
      </div>
    </section>
  );
}