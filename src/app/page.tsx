'use client';

import { PdfViewer } from '@/components/PdfViewer';

export default function Home() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-gray-100 flex flex-col font-[family-name:var(--font-geist-sans)]">
      <PdfViewer />
    </main>
  );
}
