"use client"

import { useRef, useState } from "react"
import { Tree, TreeNode } from "react-organizational-chart"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileDown, Loader2, TriangleAlert } from "lucide-react"
import { useStructureMapper, type OrgTreeNode } from "@/context/structure-mapper-context"

// Sanitasi nama file - pola sama seperti dipakai di backend untuk export
// Excel Your Structure (lihat routers/structure_mapper.py) supaya konsisten:
// spasi/karakter khusus yang tidak aman jadi nama file diganti underscore.
function sanitizeForFilename(value: string): string {
  return value.trim().replace(/[/\\:*?"<>|\s]+/g, "_")
}

// Box per posisi - cuma nama posisi (lihat STRUCTURE-MAPPER-SPEC.md bagian
// 10.4: TIDAK ada badge headcount/menu "..."/ikon collapse, karena data itu
// tidak ada di template Excel-nya dan fitur ini tidak perlu interaktif.
//
// Warna literal (bukan token Tailwind/CSS var seperti border-border/bg-card)
// dipakai di sini supaya diagram ini konsisten putih/terang sesuai contoh
// screenshot user, walau app dalam mode gelap.
function OrgBox({ name }: { name: string }) {
  return (
    <div
      className="org-diagram-box inline-block rounded-md px-4 py-2 text-left shadow-sm"
      style={{ backgroundColor: "#ffffff", border: "1px solid #d1d5db" }}
    >
      <span className="text-sm font-medium" style={{ color: "#111827" }}>
        {name}
      </span>
    </div>
  )
}

function renderNode(node: OrgTreeNode) {
  return (
    <TreeNode key={node.id} label={<OrgBox name={node.name} />}>
      {node.children.map((child) => renderNode(child))}
    </TreeNode>
  )
}

// --- Export to Image - lihat handleExportImage di bawah untuk penjelasan
// lengkap kenapa export ini dibangun manual (bukan screenshot DOM). ---

interface LayoutNode {
  name: string
  x: number
  y: number
  width: number
  height: number
  children: LayoutNode[]
}

const BOX_HEIGHT = 44
const GAP_X = 24
const GAP_Y = 56
const TREE_GAP_X = 64
const PADDING_X = 32
const CANVAS_MARGIN = 24
const FONT = "500 14px ui-sans-serif, system-ui, -apple-system, sans-serif"

// Bangun layout (posisi x/y tiap kotak) langsung dari data tree - BUKAN dari
// mengukur DOM yang sedang dirender. Algoritma standar penggambaran tree:
// daun (leaf) ditempatkan berurutan kiri-ke-kanan, tiap parent diposisikan
// di tengah rentang anak-anaknya (dihitung dari bawah/daun ke atas/root).
function layoutTree(
  node: OrgTreeNode,
  depth: number,
  cursor: { x: number },
  ctx: CanvasRenderingContext2D
): LayoutNode {
  ctx.font = FONT
  const textWidth = ctx.measureText(node.name).width
  const width = Math.max(Math.ceil(textWidth) + PADDING_X, 80)
  const height = BOX_HEIGHT
  const children = node.children.map((child) => layoutTree(child, depth + 1, cursor, ctx))

  let x: number
  if (children.length === 0) {
    x = cursor.x + width / 2
    cursor.x += width + GAP_X
  } else {
    const first = children[0]
    const last = children[children.length - 1]
    x = (first.x + last.x) / 2
  }
  const y = depth * (BOX_HEIGHT + GAP_Y) + BOX_HEIGHT / 2

  return { name: node.name, x, y, width, height, children }
}

function collectBoxesAndEdges(
  root: LayoutNode,
  boxes: LayoutNode[],
  edges: { x1: number; y1: number; x2: number; y2: number }[]
) {
  boxes.push(root)
  for (const child of root.children) {
    const parentBottomY = root.y + root.height / 2
    const childTopY = child.y - child.height / 2
    const midY = (parentBottomY + childTopY) / 2
    // Garis siku (elbow connector) - turun dari bawah parent, mendatar, lalu
    // turun lagi ke atas kotak anak. Gaya ini yang dipakai di contoh
    // screenshot user (lihat STRUCTURE-MAPPER-SPEC.md bagian 10.4).
    edges.push({ x1: root.x, y1: parentBottomY, x2: root.x, y2: midY })
    edges.push({ x1: root.x, y1: midY, x2: child.x, y2: midY })
    edges.push({ x1: child.x, y1: midY, x2: child.x, y2: childTopY })
    collectBoxesAndEdges(child, boxes, edges)
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function StepOrgDiagram() {
  const { orgCid, orgCompanyName, orgSourceFileName, orgTrees, orgWarnings, backToSelectType } =
    useStructureMapper()
  const diagramRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  if (orgTrees.length === 0) return null

  // Export gambar (PNG) - MURNI client-side, tidak ada request ke backend.
  //
  // Riwayat singkat (supaya tidak diulang lagi di masa depan kalau ada yang
  // "menyederhanakan" bagian ini tanpa tahu alasannya - sudah dicoba 2
  // library screenshot DOM, keduanya gagal karena alasan berbeda):
  // - "html2canvas": parser warna internalnya belum mendukung oklch()/lab()
  //   (dipakai hampir di semua elemen tema project ini lewat Tailwind v4
  //   CSS var) - bisa diakali untuk warna box lewat "onclone", TAPI garis
  //   penghubung (digambar react-organizational-chart lewat pseudo-element
  //   ::before/::after dengan `content: ""`) tetap tidak pernah muncul -
  //   html2canvas skip total pseudo-element ber-content string kosong, dan
  //   pengecekan itu terjadi SAAT proses clone (sebelum "onclone" sempat
  //   jalan), jadi tidak bisa diakali dari opsi manapun yang dicoba
  //   (termasuk override sementara ke halaman asli - tetap tidak berhasil).
  // - "html-to-image" (render via SVG <foreignObject>, native browser):
  //   secara teori benar (warna & pseudo-element beres), TAPI ternyata
  //   sangat lambat sampai membekukan tab browser berpuluh detik -
  //   kemungkinan besar karena dia menyalin SEMUA custom property CSS
  //   (ratusan variabel tema Tailwind v4 project ini) ke tiap node yang
  //   di-clone. Tidak dipakai karena tidak praktis.
  //
  // Solusi akhir: JANGAN screenshot DOM sama sekali. Bangun ulang diagram
  // sebagai SVG manual langsung dari DATA tree (bukan dari tampilan yang
  // sedang dirender) - kotak (rect+text) dan garis (elbow connector,
  // gaya sama seperti contoh screenshot user) semua digambar sendiri pakai
  // warna literal. Ini menghindari SELURUH masalah di atas sekaligus,
  // karena tidak pernah menyentuh computed style/pseudo-element milik
  // React/Tailwind/react-organizational-chart sama sekali.
  async function handleExportImage() {
    setExportError(null)
    setExporting(true)
    try {
      const measureCanvas = document.createElement("canvas")
      const ctx = measureCanvas.getContext("2d")
      if (!ctx) throw new Error("Canvas context tidak tersedia.")

      const cursor = { x: 0 }
      const roots: LayoutNode[] = []
      orgTrees.forEach((tree, index) => {
        if (index > 0) cursor.x += TREE_GAP_X
        roots.push(layoutTree(tree, 0, cursor, ctx))
      })

      const boxes: LayoutNode[] = []
      const edges: { x1: number; y1: number; x2: number; y2: number }[] = []
      roots.forEach((root) => collectBoxesAndEdges(root, boxes, edges))

      const contentWidth = cursor.x - GAP_X
      const maxDepth = Math.max(...boxes.map((b) => b.y))
      const contentHeight = maxDepth + BOX_HEIGHT / 2

      const width = contentWidth + CANVAS_MARGIN * 2
      const height = contentHeight + CANVAS_MARGIN * 2
      const offsetX = CANVAS_MARGIN
      const offsetY = CANVAS_MARGIN

      const edgesSvg = edges
        .map(
          (e) =>
            `<line x1="${e.x1 + offsetX}" y1="${e.y1 + offsetY}" x2="${e.x2 + offsetX}" y2="${e.y2 + offsetY}" stroke="#d1d5db" stroke-width="2" />`
        )
        .join("")
      const boxesSvg = boxes
        .map((b) => {
          const x = b.x - b.width / 2 + offsetX
          const y = b.y - b.height / 2 + offsetY
          return (
            `<rect x="${x}" y="${y}" width="${b.width}" height="${b.height}" rx="6" fill="#ffffff" stroke="#d1d5db" stroke-width="1" />` +
            `<text x="${b.x + offsetX}" y="${b.y + offsetY}" text-anchor="middle" dominant-baseline="middle" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="14" font-weight="500" fill="#111827">${escapeXml(b.name)}</text>`
          )
        })
        .join("")

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#ffffff" />${edgesSvg}${boxesSvg}</svg>`

      const scale = 2
      const canvas = document.createElement("canvas")
      canvas.width = width * scale
      canvas.height = height * scale
      const canvasCtx = canvas.getContext("2d")
      if (!canvasCtx) throw new Error("Canvas context tidak tersedia.")

      const img = new Image()
      const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
      const svgUrl = URL.createObjectURL(svgBlob)
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("Gagal me-render SVG diagram."))
        img.src = svgUrl
      })
      canvasCtx.scale(scale, scale)
      canvasCtx.drawImage(img, 0, 0)
      URL.revokeObjectURL(svgUrl)

      const dataUrl = canvas.toDataURL("image/png")

      const safeCid = orgCid ? sanitizeForFilename(orgCid) : "CID"
      const safeCompany = orgCompanyName ? sanitizeForFilename(orgCompanyName) : "Company"
      const link = document.createElement("a")
      link.href = dataUrl
      link.download = `StructureYourExcel_${safeCid}-${safeCompany}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch {
      setExportError("Gagal membuat file gambar. Silakan coba lagi.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Diagram Struktur — Structure Your Excel</CardTitle>
        <CardDescription>
          Diagram struktur untuk <strong>{orgCid}</strong> — <strong>{orgCompanyName}</strong>,
          dari dokumen <strong>{orgSourceFileName}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {orgWarnings.length > 0 && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="mb-1 flex items-center gap-1.5 font-medium">
              <TriangleAlert className="h-4 w-4" />
              Ada {orgWarnings.length} peringatan pada file yang diupload
            </div>
            <ul className="list-inside list-disc space-y-0.5">
              {orgWarnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="overflow-x-auto pb-4">
          <div
            ref={diagramRef}
            id="org-diagram-capture"
            className="flex min-w-fit flex-wrap justify-center gap-x-16 gap-y-8 px-8 py-4"
            style={{ backgroundColor: "#ffffff" }}
          >
            {/* Lebih dari 1 pohon (forest) kalau file punya lebih dari 1 root -
                lihat STRUCTURE-MAPPER-SPEC.md bagian 10.3, ditampilkan
                berdampingan, BUKAN dianggap error. */}
            {orgTrees.map((tree) => (
              <Tree
                key={tree.id}
                label={<OrgBox name={tree.name} />}
                lineWidth="2px"
                lineColor="#d1d5db"
                lineBorderRadius="6px"
                nodePadding="8px"
              >
                {tree.children.map((child) => renderNode(child))}
              </Tree>
            ))}
          </div>
        </div>
        {exportError && <p className="mt-2 text-sm text-red-600">{exportError}</p>}
      </CardContent>
      <div className="flex justify-end gap-2 px-6 pb-6">
        <Button variant="outline" onClick={handleExportImage} disabled={exporting}>
          {exporting ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="mr-1.5 h-4 w-4" />
          )}
          Export to Image
        </Button>
        <Button variant="outline" onClick={backToSelectType}>
          Kembali
        </Button>
      </div>
    </Card>
  )
}
