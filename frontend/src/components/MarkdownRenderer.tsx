'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose prose-invert max-w-none text-sm leading-relaxed space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="text-base font-bold text-white mt-3 mb-1.5 border-b border-slate-800 pb-1" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-sm font-bold text-indigo-300 mt-2.5 mb-1" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-xs font-semibold text-purple-300 mt-2 mb-1" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="mb-2 leading-relaxed text-slate-200 text-xs" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside space-y-1 my-2 pl-2 text-xs text-slate-300" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-inside space-y-1 my-2 pl-2 text-xs text-slate-300" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="text-xs text-slate-300 leading-normal" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-indigo-200" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic text-purple-200" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-indigo-500 pl-3 py-1 my-2 bg-indigo-950/40 rounded-r-xl italic text-xs text-indigo-200" {...props} />
          ),
          code: ({ node, inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code className="bg-slate-900 text-indigo-300 px-1.5 py-0.5 rounded font-mono text-[11px] border border-slate-800" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <pre className="bg-slate-900/90 text-slate-100 p-3 rounded-xl overflow-x-auto font-mono text-xs border border-slate-800 my-2">
                <code {...props}>{children}</code>
              </pre>
            );
          },
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-3 rounded-xl border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800 text-xs text-left" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="bg-slate-900 px-3 py-2 font-semibold text-slate-200 uppercase text-[10px]" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-3 py-2 text-slate-300 border-t border-slate-800/60" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a className="text-indigo-400 hover:text-indigo-300 underline transition" target="_blank" rel="noopener noreferrer" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
