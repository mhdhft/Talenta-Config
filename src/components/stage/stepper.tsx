"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { STAGE_STEPS, useStage } from "@/context/stage-context"

export function Stepper() {
  const { currentStep, maxStepReached, goToStep } = useStage()

  return (
    <ol className="flex w-full items-start">
      {STAGE_STEPS.map((label, index) => {
        const step = index + 1
        const isCompleted = step < currentStep || step < maxStepReached
        const isCurrent = step === currentStep
        const isReachable = step <= maxStepReached

        return (
          <li key={label} className="flex flex-1 flex-col items-center last:flex-none">
            <div className="flex w-full items-center">
              <button
                type="button"
                disabled={!isReachable}
                onClick={() => goToStep(step)}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                  isCompleted
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCurrent
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground",
                  isReachable ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : step}
              </button>
              {index < STAGE_STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-0.5 flex-1",
                    isCompleted ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>
            <span
              className={cn(
                "mt-2 text-center text-xs font-medium",
                isCurrent ? "text-primary" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
