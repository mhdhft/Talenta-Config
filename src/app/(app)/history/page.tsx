"use client"

import { useEffect, useState, type FormEvent } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Trash2, Search, Download } from "lucide-react"
import { HistoryStatusBadge } from "@/components/history/history-status-badge"
import { getHistory, deleteHistoryEntry, downloadReport, type HistoryEntry, ApiError } from "@/lib/api"

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [pendingDelete, setPendingDelete] = useState<HistoryEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  function fetchHistory(q?: string) {
    return getHistory(q)
      .then(setEntries)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Gagal memuat riwayat proses.")
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    fetchHistory(search)
  }

  async function handleDownload(entry: HistoryEntry) {
    setDownloadingId(entry.id)
    setError(null)
    try {
      const { blob, filename } = await downloadReport(entry.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengunduh report.")
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deleteHistoryEntry(pendingDelete.id)
      setEntries((prev) => prev.filter((entry) => entry.id !== pendingDelete.id))
      setPendingDelete(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menghapus riwayat proses.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">
          Riwayat proses pemetaan posisi yang pernah dilakukan.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Proses</CardTitle>
          <CardDescription>{entries.length} proses tercatat.</CardDescription>
          <form onSubmit={handleSearchSubmit} className="flex gap-2 pt-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari berdasarkan CID atau Company Name..."
                className="pl-8"
              />
            </div>
            <Button type="submit" variant="outline">
              Cari
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat riwayat...
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-600">{error}</p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada proses yang tercatat.
            </p>
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>CID</TableHead>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Dokumen Baru</TableHead>
                    <TableHead>Dokumen Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.date}</TableCell>
                      <TableCell>{entry.cid}</TableCell>
                      <TableCell>{entry.companyName}</TableCell>
                      <TableCell>{entry.newFileName ?? "-"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.referenceFileName ?? "-"}
                      </TableCell>
                      <TableCell>
                        <HistoryStatusBadge status={entry.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDownload(entry)}
                            disabled={!entry.fileAvailable || downloadingId === entry.id}
                            aria-label="Download"
                            title={
                              entry.fileAvailable
                                ? "Download report"
                                : "File sudah tidak tersedia"
                            }
                          >
                            {downloadingId === entry.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setPendingDelete(entry)}
                            aria-label="Hapus"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apakah yakin ingin menghapus?</DialogTitle>
            <DialogDescription>
              Proses {pendingDelete?.companyName} ({pendingDelete?.cid}) akan dihapus dari
              History. Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={deleting} />}>
              Batal
            </DialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
