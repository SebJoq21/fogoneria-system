import { Camera, FileText, ReceiptText } from 'lucide-react'

const icons = {
  images: Camera,
  document: FileText,
  payment: ReceiptText,
}

function DropZone({ type = 'images', text }) {
  const Icon = icons[type] || Camera

  return (
    <label className="border-2 border-dashed border-slate-300 rounded-xl py-6 px-4 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-slate-500">
      <input type="file" className="hidden" />
      <Icon className="w-10 h-10 mb-3 text-slate-400" />
      <span className="text-sm">{text}</span>
    </label>
  )
}

export default DropZone
