import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "kbrain-cert · 공식 자격 검정 플랫폼",
  description:
    "kbrain-cert는 공식 자격증 검정을 위한 CBT 플랫폼입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50/30 text-slate-900">
        {children}
      </body>
    </html>
  );
}
