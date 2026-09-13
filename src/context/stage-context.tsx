"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import type { ColumnMatch, ResultRow } from "@/lib/api"

export const STAGE_STEPS = [
  "Input Company Info",
  "Upload New Document",
  "Upload Reference",
  "Analysis",
  "Resume",
  "Report",
] as const

export type StageStep = (typeof STAGE_STEPS)[number]

interface StageState {
  currentStep: number
  maxStepReached: number
  analysisRunId: number | null
  cid: string | null
  companyName: string | null
  effectiveDate: string | null
  transferType: string | null
  newDocName: string | null
  referenceDocName: string | null
  matches: ColumnMatch[]
  standardFields: string[]
  analyzed: boolean
  selectedFields: string[]
  resultRows: ResultRow[]
  idsOnlyInNew: string[]
  idsOnlyInReference: string[]
  reportGenerated: boolean
  reportDownloadUrl: string | null
}

interface StageContextValue extends StageState {
  setCompanyInfo: (
    analysisRunId: number,
    cid: string,
    companyName: string,
    effectiveDate: string | null,
    transferType: string | null
  ) => void
  uploadNewDocument: (fileName: string) => void
  uploadReferenceDocument: (fileName: string) => void
  setMatches: (matches: ColumnMatch[], standardFields: string[]) => void
  runAnalysis: (
    selectedFields: string[],
    resultRows: ResultRow[],
    idsOnlyInNew: string[],
    idsOnlyInReference: string[]
  ) => void
  goToReport: () => void
  generateReport: (downloadUrl: string) => void
  goToStep: (step: number) => void
  reset: () => void
}

const initialState: StageState = {
  currentStep: 1,
  maxStepReached: 1,
  analysisRunId: null,
  cid: null,
  companyName: null,
  effectiveDate: null,
  transferType: null,
  newDocName: null,
  referenceDocName: null,
  matches: [],
  standardFields: [],
  analyzed: false,
  selectedFields: [],
  resultRows: [],
  idsOnlyInNew: [],
  idsOnlyInReference: [],
  reportGenerated: false,
  reportDownloadUrl: null,
}

const StageContext = createContext<StageContextValue | null>(null)

export function StageProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StageState>(initialState)

  const value = useMemo<StageContextValue>(
    () => ({
      ...state,
      setCompanyInfo: (
        analysisRunId: number,
        cid: string,
        companyName: string,
        effectiveDate: string | null,
        transferType: string | null
      ) =>
        setState((prev) => ({
          ...prev,
          analysisRunId,
          cid,
          companyName,
          effectiveDate,
          transferType,
          currentStep: 2,
          maxStepReached: Math.max(prev.maxStepReached, 2),
        })),
      uploadNewDocument: (fileName: string) =>
        setState((prev) => ({
          ...prev,
          newDocName: fileName,
          // Kolom di New Document yang baru bisa berbeda dari sebelumnya -
          // mapping/field standar lama sudah tidak relevan, harus di-fetch
          // ulang di step Analysis (lihat CLAUDE.md bagian 4 & 5).
          matches: [],
          standardFields: [],
          currentStep: 3,
          maxStepReached: Math.max(prev.maxStepReached, 3),
        })),
      uploadReferenceDocument: (fileName: string) =>
        setState((prev) => ({
          ...prev,
          referenceDocName: fileName,
          // Reference Document yang baru menentukan ulang daftar field
          // standar (lihat fix STANDARD_FIELDS dinamis) - mapping lama harus
          // di-fetch ulang, jangan pakai cache dari Reference Document
          // sebelumnya.
          matches: [],
          standardFields: [],
          currentStep: 4,
          maxStepReached: Math.max(prev.maxStepReached, 4),
        })),
      setMatches: (matches: ColumnMatch[], standardFields: string[]) =>
        setState((prev) => ({ ...prev, matches, standardFields })),
      runAnalysis: (
        selectedFields: string[],
        resultRows: ResultRow[],
        idsOnlyInNew: string[],
        idsOnlyInReference: string[]
      ) =>
        setState((prev) => ({
          ...prev,
          analyzed: true,
          selectedFields,
          resultRows,
          idsOnlyInNew,
          idsOnlyInReference,
          currentStep: 5,
          maxStepReached: Math.max(prev.maxStepReached, 5),
        })),
      goToReport: () =>
        setState((prev) => ({
          ...prev,
          currentStep: 6,
          maxStepReached: Math.max(prev.maxStepReached, 6),
        })),
      generateReport: (downloadUrl: string) =>
        setState((prev) => ({
          ...prev,
          reportGenerated: true,
          reportDownloadUrl: downloadUrl,
        })),
      goToStep: (step: number) =>
        setState((prev) =>
          step <= prev.maxStepReached ? { ...prev, currentStep: step } : prev
        ),
      reset: () => setState(initialState),
    }),
    [state]
  )

  return <StageContext.Provider value={value}>{children}</StageContext.Provider>
}

export function useStage() {
  const ctx = useContext(StageContext)
  if (!ctx) {
    throw new Error("useStage must be used within a StageProvider")
  }
  return ctx
}
