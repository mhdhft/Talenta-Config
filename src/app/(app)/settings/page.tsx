"use client"

import { useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

export default function SettingsPage() {
  const { user } = useAuth()
  const [name, setName] = useState(user?.name ?? "")
  const [language, setLanguage] = useState("id")
  const [notification, setNotification] = useState("aktif")
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setSaved(true)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Pengaturan akun dan preferensi aplikasi.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>Informasi akun yang sedang login.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nama</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSaved(false)
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ""} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferensi</CardTitle>
          <CardDescription>Pengaturan bahasa dan notifikasi.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language">Bahasa</Label>
            <select
              id="language"
              className={selectClassName}
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value)
                setSaved(false)
              }}
            >
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notification">Notifikasi Email</Label>
            <select
              id="notification"
              className={selectClassName}
              value={notification}
              onChange={(e) => {
                setNotification(e.target.value)
                setSaved(false)
              }}
            >
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
          </div>
        </CardContent>
        <CardFooter className="flex items-center gap-3">
          <Button onClick={handleSave}>Simpan Perubahan</Button>
          {saved && (
            <span className="text-sm text-muted-foreground">Pengaturan disimpan.</span>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
