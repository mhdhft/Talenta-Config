"use client"

import { Stepper } from "@/components/stage/stepper"
import { StepCompanyInfo } from "@/components/stage/step-company-info"
import { StepUploadNew } from "@/components/stage/step-upload-new"
import { StepUploadReference } from "@/components/stage/step-upload-reference"
import { StepAnalysis } from "@/components/stage/step-analysis"
import { StepResume } from "@/components/stage/step-resume"
import { StepReport } from "@/components/stage/step-report"
import { useStage } from "@/context/stage-context"

export default function StagePage() {
  const { currentStep } = useStage()

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Stage</h1>
        <p className="text-sm text-muted-foreground">
          Ikuti tahapan berikut untuk memproses pemetaan posisi karyawan.
        </p>
      </div>

      <Stepper />

      <div
        className={
          currentStep === 4 || currentStep === 5 ? "" : "mx-auto w-full max-w-2xl"
        }
      >
        {currentStep === 1 && <StepCompanyInfo />}
        {currentStep === 2 && <StepUploadNew />}
        {currentStep === 3 && <StepUploadReference />}
        {currentStep === 4 && <StepAnalysis />}
        {currentStep === 5 && <StepResume />}
        {currentStep === 6 && <StepReport />}
      </div>
    </div>
  )
}
