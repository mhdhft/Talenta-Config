import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StageProvider } from "@/context/stage-context";
import { StructureMapperProvider } from "@/context/structure-mapper-context";
import { AuthProvider } from "@/context/auth-context";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Talenta Sync Config AI",
  description: "Otomasi pemetaan perpindahan posisi karyawan",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AuthProvider>
          <StageProvider>
            <StructureMapperProvider>{children}</StructureMapperProvider>
          </StageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
