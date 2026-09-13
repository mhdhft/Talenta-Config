"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { ConfidenceBadge } from "@/components/stage/confidence-badge"
import { useStage } from "@/context/stage-context"
import { matchColumns, compareValues, ApiError } from "@/lib/api"

const selectClassName =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const UNMAPPED = ""

export function StepAnalysis() {
  const {
    analysisRunId,
    newDocName,
    referenceDocName,
    matches,
    standardFields,
    setMatches,
    runAnalysis,
  } = useStage()

  const [loadingMatches, setLoadingMatches] = useState(matches.length === 0)
  const [matchError, setMatchError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [mappedFields, setMappedFields] = useState<Record<string, string>>(() =>
    Object.fromEntries(matches.map((m) => [m.kolom_new_document, m.field_standar_terdeteksi ?? UNMAPPED]))
  )
  const [checkedFields, setCheckedFields] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!analysisRunId || matches.length > 0) return
    let cancelled = false
    matchColumns(analysisRunId)
      .then((res) => {
        if (cancelled) return
        setMatches(res.matches, res.standard_fields)
        setMappedFields(
          Object.fromEntries(
            res.matches.map((m) => [m.kolom_new_document, m.field_standar_terdeteksi ?? UNMAPPED])
          )
        )
      })
      .catch((err) => {
        if (cancelled) return
        setMatchError(
          err instanceof ApiError ? err.message : "Gagal memuat hasil pencocokan kolom."
        )
      })
      .finally(() => {
        if (!cancelled) setLoadingMatches(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisRunId])

  const availableFields = useMemo(() => {
    const mapped = new Set(Object.values(mappedFields).filter((f) => f !== UNMAPPED))
    return standardFields.filter((field) => mapped.has(field))
  }, [mappedFields, standardFields])

  function handleMappingChange(kolom: string, field: string) {
    setMappedFields((prev) => ({ ...prev, [kolom]: field }))
  }

  function toggleField(field: string) {
    setCheckedFields((prev) => {
      const next = new Set(prev)
      if (next.has(field)) {
        next.delete(field)
      } else {
        next.add(field)
      }
      return next
    })
  }

  async function handleAnalyze() {
    if (!analysisRunId) return
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const columnMapping = Object.fromEntries(
        Object.entries(mappedFields).filter(([, field]) => field !== UNMAPPED)
      )
      const selectedFields = Array.from(checkedFields)
      const res = await compareValues(analysisRunId, columnMapping, selectedFields)
      runAnalysis(selectedFields, res.rows, res.ids_only_in_new, res.ids_only_in_reference)
    } catch (err) {
      setAnalyzeError(
        err instanceof ApiError ? err.message : "Gagal menjalankan analisis. Silakan coba lagi."
      )
    } finally {
      setAnalyzing(false)
    }
  }

  const canAnalyze = checkedFields.size > 0

  if (loadingMatches) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Mencocokkan kolom di New Document dengan field standar...
          </p>
        </CardContent>
      </Card>
    )
  }

  if (matchError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-red-600">{matchError}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Menganalisis <strong>{newDocName}</strong> (New) terhadap{" "}
        <strong>{referenceDocName}</strong> (Reference).
      </p>

      <Card>
        <CardHeader>
          <CardTitle>3a. Review Column Mapping</CardTitle>
          <CardDescription>
            Hasil pencocokan otomatis kolom di Dokumen Baru dengan field standar dari
            Template A. Koreksi dulu baris yang ditandai &quot;Perlu Dicek&quot; sebelum
            lanjut.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kolom di New Document</TableHead>
                  <TableHead>Field Standar</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((row) => (
                  <TableRow key={row.kolom_new_document}>
                    <TableCell className="font-medium">{row.kolom_new_document}</TableCell>
                    <TableCell>
                      <select
                        className={selectClassName}
                        value={mappedFields[row.kolom_new_document] ?? UNMAPPED}
                        onChange={(e) =>
                          handleMappingChange(row.kolom_new_document, e.target.value)
                        }
                      >
                        <option value={UNMAPPED}>(Tidak dipetakan)</option>
                        {standardFields.map((field) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <ConfidenceBadge confidence={row.confidence} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3b. Checklist Field untuk Dianalisis</CardTitle>
          <CardDescription>
            Pilih field mana saja yang ingin dibandingkan. Field yang tidak dicentang
            tidak akan diproses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {availableFields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada field yang terpetakan. Periksa kembali mapping di atas.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {availableFields.map((field) => (
                <label
                  key={field}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={checkedFields.has(field)}
                    onChange={() => toggleField(field)}
                  />
                  {field}
                </label>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex-col items-end gap-2">
          {analyzeError && <span className="text-sm text-red-600">{analyzeError}</span>}
          <Button onClick={handleAnalyze} disabled={!canAnalyze || analyzing} size="lg">
            {analyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {analyzing ? "Menganalisis..." : "Analyze"}
          </Button>
          {!canAnalyze && (
            <span className="text-xs text-muted-foreground">
              Pilih minimal 1 field untuk melanjutkan.
            </span>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
