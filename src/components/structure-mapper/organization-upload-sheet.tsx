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
import { FileSpreadsheet, Loader2, UploadCloud } from "lucide-react"
import { useStructureMapper } from "@/context/structure-mapper-context"
import { ApiError, uploadOrganizationStructure } from "@/lib/api"

interface OrganizationUploadSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Fase F2 - lihat STRUCTURE-MAPPER-SPEC.md bagian 10.2, 10.3 & 10.5. Submit
// memanggil endpoint asli (POST /structure-mapper/organization/upload,
// parsing Excel deterministik - TIDAK pakai AI), bukan dummy lagi (Fase F1).
export function OrganizationUploadSheet({ open, onOpenChange }: OrganizationUploadSheetProps) {
  const { applyOrganizationUploadResult } = useStructureMapper()
  const [cid, setCid] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = cid.trim() !== "" && companyName.trim() !== "" && file !== null && !submitting

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || !file) return

    // Validasi format tampilan (ekstensi) - validasi ISI file (sheet/header)
    // tetap dilakukan di backend, ini cuma pengecekan cepat di sisi UI.
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (ext !== "xlsx" && ext !== "xls") {
      setError("Format file tidak didukung. Upload file Excel (.xlsx atau .xls).")
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      const result = await uploadOrganizationStructure(cid.trim(), companyName.trim(), file)
      applyOrganizationUploadResult(result)
      onOpenChange(false)
      setCid("")
      setCompanyName("")
      setFile(null)
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
        // Sama seperti job-position-upload-sheet.tsx - jangan biarkan sheet
        // tertutup selagi masih menunggu proses parsing.
        if (submitting) return
        onOpenChange(next)
      }}
    >
      <SheetContent side="right">
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Structure Your Excel — Upload Dokumen</SheetTitle>
            <SheetDescription>
              Isi informasi perusahaan lalu upload file Excel struktur jabatan
              (format tetap, lihat template) untuk ditampilkan sebagai diagram.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 px-4">
            <div className="space-y-2">
              <Label htmlFor="org-cid">Company ID (CID)</Label>
              <Input
                id="org-cid"
                value={cid}
                onChange={(e) => setCid(e.target.value)}
                disabled={submitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-company-name">Company Name</Label>
              <Input
                id="org-company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={submitting}
                required
              />
            </div>
            <div>
              <Label htmlFor="org-file-upload" className="mb-2 block">
                Upload dokumen (XLSX, XLS)
              </Label>
              <label
                htmlFor="org-file-upload"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/40 px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/60 aria-disabled:pointer-events-none aria-disabled:opacity-60"
                aria-disabled={submitting}
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
                    <span className="text-sm font-medium">Klik untuk pilih file</span>
                    <span className="text-xs text-muted-foreground">
                      Format didukung: XLSX, XLS
                    </span>
                  </>
                )}
              </label>
              <input
                id="org-file-upload"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={submitting}
                onChange={(e) => {
                  setError(null)
                  setFile(e.target.files?.[0] ?? null)
                }}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <SheetFooter className="flex-col items-stretch gap-2">
            {submitting && (
              <p className="text-center text-xs text-muted-foreground">
                Memproses file Excel, mohon tunggu...
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
