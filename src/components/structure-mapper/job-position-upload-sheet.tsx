"use client"

import { useState, type FormEvent } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { FileImage, Loader2, UploadCloud } from "lucide-react"
import { useStructureMapper } from "@/context/structure-mapper-context"
import { ApiError, uploadJobPositionStructure } from "@/lib/api"

interface JobPositionUploadSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function JobPositionUploadSheet({ open, onOpenChange }: JobPositionUploadSheetProps) {
  const { applyJobPositionUploadResult } = useStructureMapper()
  const [cid, setCid] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [ignoreUnsolidLine, setIgnoreUnsolidLine] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = cid.trim() !== "" && companyName.trim() !== "" && file !== null && !submitting

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || !file) return
    setError(null)
    setSubmitting(true)
    try {
      const result = await uploadJobPositionStructure(
        cid.trim(),
        companyName.trim(),
        file,
        ignoreUnsolidLine
      )
      applyJobPositionUploadResult(result)
      onOpenChange(false)
      setCid("")
      setCompanyName("")
      setFile(null)
      setIgnoreUnsolidLine(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Terjadi kesalahan. Silakan coba lagi.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // Jangan biarkan sheet tertutup (klik luar/Escape) selagi masih
        // menunggu AI - request tetap jalan di background, tapi UX-nya
        // bakal aneh kalau sheet-nya hilang duluan sebelum hasilnya siap.
        if (submitting) return
        onOpenChange(next)
      }}
    >
      <SheetContent side="right">
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Job Position — Upload Dokumen</SheetTitle>
          <SheetDescription>
            Isi informasi perusahaan lalu upload dokumen struktur jabatan (gambar/scan)
            untuk dianalisa.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 px-4">
          <div className="space-y-2">
            <Label htmlFor="sm-cid">Company ID (CID)</Label>
            <Input
              id="sm-cid"
              value={cid}
              onChange={(e) => setCid(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sm-company-name">Company Name</Label>
            <Input
              id="sm-company-name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div>
            <Label htmlFor="sm-file-upload" className="mb-2 block">
              Upload dokumen (PDF, JPG, JPEG, PNG)
            </Label>
            <label
              htmlFor="sm-file-upload"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/40 px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/60 aria-disabled:pointer-events-none aria-disabled:opacity-60"
              aria-disabled={submitting}
            >
              {file ? (
                <>
                  <FileImage className="h-8 w-8 text-primary" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Klik untuk ganti file
                  </span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm font-medium">Klik untuk pilih file</span>
                  <span className="text-xs text-muted-foreground">
                    Format didukung: PDF, JPG, JPEG, PNG
                  </span>
                </>
              )}
            </label>
            <input
              id="sm-file-upload"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              disabled={submitting}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <div className="mt-3 space-y-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={ignoreUnsolidLine}
                  disabled={submitting}
                  onChange={(e) => setIgnoreUnsolidLine(e.target.checked)}
                />
                Ignore Unsolid Line
              </label>
              <p className="text-xs text-muted-foreground">
                Kalau dicentang, garis putus-putus akan diabaikan saat menentukan
                atasan langsung (parent) - posisi yang jadi tidak punya atasan akan
                ditandai &quot;Unmapped&quot;, tanpa perlu dicek manual.
              </p>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <SheetFooter className="flex-col items-stretch gap-2">
          {submitting && (
            <p className="text-center text-xs text-muted-foreground">
              Menganalisa dokumen dengan AI, mohon tunggu (bisa memakan waktu sampai
              sekitar 30 detik)...
            </p>
          )}
          <Button type="submit" disabled={!canSubmit}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit
          </Button>
        </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
