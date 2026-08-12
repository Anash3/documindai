import './globals.css';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DocuMind AI - Intelligent Document Analysis Platform',
  description: 'Upload PDF and DOCX documents and ask questions powered by OpenAI SDK and semantic RAG vector search.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
