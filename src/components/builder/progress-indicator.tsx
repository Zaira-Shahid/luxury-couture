import { cn } from "@/lib/utils";

export function ProgressIndicator({
  steps,
  currentStep,
}: {
  steps: readonly string[];
  currentStep: number;
}) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-2 text-xs">
      {steps.map((label, i) => (
        <li key={label} className="flex shrink-0 items-center gap-1">
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full border text-[0.7rem]",
              i === currentStep
                ? "border-primary bg-primary text-primary-foreground"
                : i < currentStep
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground"
            )}
          >
            {i + 1}
          </span>
          <span
            className={cn(
              "whitespace-nowrap",
              i === currentStep ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {label}
          </span>
          {i < steps.length - 1 ? <span className="mx-1 text-muted-foreground">—</span> : null}
        </li>
      ))}
    </ol>
  );
}
