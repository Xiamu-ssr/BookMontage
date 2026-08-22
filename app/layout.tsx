import type { Metadata } from 'next';
import './globals.css';
/* eslint-disable @next/next/no-page-custom-font -- vinext app layout owns the single document head */

export const metadata: Metadata = {
  title: '书间 BookMontage',
  description: 'Harness-first 的本地长篇 AI 影像世界工作台。',
  openGraph: {
    title: '书间 BookMontage',
    description: '人类负责想象与裁定，Harness 负责整理与执行。',
    images: ['/book-assets/71833c166aaf4e0ca53e28c00793e35a0001.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Special+Elite&display=swap" rel="stylesheet" />
  </head><body>{children}</body></html>;
}
