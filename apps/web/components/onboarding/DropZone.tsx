"use client";

import { Camera, FileText, ReceiptText } from "lucide-react";

const icons = {
  images: Camera,
  document: FileText,
  payment: ReceiptText,
} as const;

export function DropZone({
  type = "images",
  text,
  fileName,
  accept,
  onFile,
}: {
  type?: keyof typeof icons;
  text: string;
  fileName?: string;
  accept?: string;
  onFile?: (file: File) => void;
}) {
  const Icon = icons[type] ?? Camera;

  return (
    <label className="border-2 border-dashed border-ink-900/15 rounded-2xl py-6 px-4 flex flex-col items-center justify-center bg-primary/[0.02] hover:bg-primary-hover/[0.05] transition-colors cursor-pointer text-ink-600">
      <input
        type="file"
        accept={accept ?? (type === "images" ? "image/*" : undefined)}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && onFile) onFile(file);
        }}
      />
      {/* Ícono tarjeta 20px */}
      <Icon size={20} className="mb-3 text-ink-400" />
      <span className="text-sm">{text}</span>
      {fileName && <span className="text-xs text-ink-400 mt-1">{fileName}</span>}
    </label>
  );
}
