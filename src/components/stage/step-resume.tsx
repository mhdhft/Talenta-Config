"use client"

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
import { StatusBadge } from "@/components/stage/status-badge"
import { useStage } from "@/context/stage-context"

export function StepResume() {
  const { goToReport, selectedFields, resultRows } = useStage()

  // Baris "Not Found" selalu ditampilkan - ini soal karyawan yang tidak match
  // antar dokumen, bukan perbedaan pada field tertentu, jadi tidak ikut
  // disaring oleh checklist field di step 3b.
  const filteredRows = resultRows.filter(
    (row) => row.status === "Not Found" || selectedFields.includes(row.field)
  )

  const needConfirmationCount = filteredRows.filter(
    (row) => row.status === "Need Confirmation"
  ).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resume</CardTitle>
        <CardDescription>
          Hasil mapping AI antara Dokumen New dan Dokumen Reference, untuk field yang
          dipilih: {selectedFields.join(", ")}.
          {needConfirmationCount > 0 && (
            <span className="ml-1 font-medium text-red-600">
              {needConfirmationCount} baris perlu konfirmasi.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {filteredRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Tidak ada data perubahan untuk field yang dipilih.
          </p>
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Nilai Lama</TableHead>
                  <TableHead>Nilai Baru</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{row.employee_id}</TableCell>
                    <TableCell>{row.employee_name ?? "-"}</TableCell>
                    <TableCell>{row.field}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.nilai_lama ?? "-"}
                    </TableCell>
                    <TableCell>{row.nilai_baru ?? "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={row.status} />
                        {row.note && (
                          <span className="text-xs text-muted-foreground">
                            {row.note}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={goToReport}>Lanjut ke Report</Button>
      </CardFooter>
    </Card>
  )
}
