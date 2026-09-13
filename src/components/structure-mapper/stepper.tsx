"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { STRUCTURE_MAPPER_STEPS, useStructureMapper } from "@/context/structure-mapper-context"

export function StructureMapperStepper() {
  const { step, maxStepReached, goToStep } = useStructureMapper()
  const currentStep = STRUCTURE_MAPPER_STEPS.findIndex((s) => s.key === step) + 1

  return (
    <ol className="flex w-full items-start">
      {STRUCTURE_MAPPER_STEPS.map((s, index) => {
        const stepNumber = index + 1
        const isCompleted = stepNumber < currentStep || stepNumber < maxStepReached
        const isCurrent = stepNumber === currentStep
        const isReachable = stepNumber <= maxStepReached

        return (
          <li key={s.key} className="flex flex-1 flex-col items-center last:flex-none">
            <div className="flex w-full items-center">
              <button
                type="button"
                disabled={!isReachable}
                onClick={() => goToStep(stepNumber)}
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
                {isCompleted ? <Check className="h-4 w-4" /> : stepNumber}
              </button>
              {index < STRUCTURE_MAPPER_STEPS.length - 1 && (
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
              {s.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
