"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { UploadCloud, FileSpreadsheet, Loader2 } from "lucide-react"
import { useStage } from "@/context/stage-context"
import { uploadReferenceDocument, ApiError } from "@/lib/api"

export function StepUploadReference() {
  const { analysisRunId, uploadReferenceDocument: setReferenceUploaded } = useStage()
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!file || !analysisRunId) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await uploadReferenceDocument(analysisRunId, file)
      setReferenceUploaded(res.filename)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengupload file.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Reference</CardTitle>
        <CardDescription>
          Upload dokumen pembanding/data lama yang akan jadi acuan analisis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="reference-upload" className="mb-2 block">
            Pilih file (.xlsx atau .csv)
          </Label>
          <label
            htmlFor="reference-upload"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/40 px-4 py-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/60"
          >
            {file ? (
              <>
                <FileSpreadsheet className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  Klik untuk ganti file
                </span>
              </>
            ) : (
              <>
                <UploadCloud className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Klik untuk pilih file, atau seret ke sini
                </span>
                <span className="text-xs text-muted-foreground">
                  Format didukung: .xlsx, .csv
                </span>
              </>
            )}
          </label>
          <input
            id="reference-upload"
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setError(null)
            }}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={handleSubmit} disabled={submitting || !file} className="w-full">
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitting ? "Mengunggah..." : "Upload Reference"}
        </Button>
      </CardContent>
    </Card>
  )
}
