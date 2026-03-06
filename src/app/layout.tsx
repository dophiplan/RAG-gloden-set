import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR, Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/context/ThemeContext";
import "./globals.css";

const notoSansKR = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap", // 폰트 로딩 중 텍스트 즉시 표시
  preload: true,
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "Language Monster",
  description: "번역 리소스 관리 시스템 - PDF에서 번역 대상 텍스트를 추출하고 관리합니다.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#818CF8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* Preconnect to Supabase for faster API calls */}
        <link 
          rel="preconnect" 
          href={process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"} 
        />
        <link 
          rel="dns-prefetch" 
          href={process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"} 
        />
      </head>
      <body
        className={`${notoSansKR.variable} ${inter.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          <Toaster />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
