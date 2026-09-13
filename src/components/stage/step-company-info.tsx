"use client"

import { useState, type FormEvent } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import { useStage } from "@/context/stage-context"
import { createAnalysisRun, TRANSFER_TYPE_OPTIONS, ApiError } from "@/lib/api"

const selectClassName =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

export function StepCompanyInfo() {
  const { setCompanyInfo } = useStage()
  const [cid, setCid] = useState("")
  const [companyName, setCompanyName] = useState("")

  const [useEffectiveDate, setUseEffectiveDate] = useState(false)
  const [effectiveDate, setEffectiveDate] = useState("")
  const [useTransferType, setUseTransferType] = useState(false)
  const [transferType, setTransferType] = useState("")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit =
    cid.trim() !== "" &&
    companyName.trim() !== "" &&
    (!useEffectiveDate || effectiveDate !== "") &&
    (!useTransferType || transferType !== "")

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await createAnalysisRun(
        cid.trim(),
        companyName.trim(),
        useEffectiveDate ? effectiveDate : null,
        useTransferType ? transferType : null
      )
      setCompanyInfo(
        res.analysis_run_id,
        res.cid,
        res.company_name,
        res.effective_date,
        res.transfer_type
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan Company Info.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Input Company Info</CardTitle>
        <CardDescription>
          Isi informasi perusahaan klien untuk proses pemetaan ini.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cid">Company ID (CID)</Label>
            <Input
              id="cid"
              value={cid}
              onChange={(e) => setCid(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name</Label>
            <Input
              id="company-name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={useEffectiveDate}
                onChange={(e) => {
                  setUseEffectiveDate(e.target.checked)
                  if (!e.target.checked) setEffectiveDate("")
                }}
              />
              Isi Effective Date sekarang?
            </label>
            {useEffectiveDate && (
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                required
              />
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={useTransferType}
                onChange={(e) => {
                  setUseTransferType(e.target.checked)
                  if (!e.target.checked) setTransferType("")
                }}
              />
              Isi Transfer Type sekarang?
            </label>
            {useTransferType && (
              <select
                className={selectClassName}
                value={transferType}
                onChange={(e) => setTransferType(e.target.value)}
                required
              >
                <option value="" disabled>
                  Pilih Transfer Type
                </option>
                {TRANSFER_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={submitting || !canSubmit} className="w-full">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting ? "Menyimpan..." : "Lanjut ke Upload New Document"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
