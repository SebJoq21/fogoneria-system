"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/fields";
import { useModules } from "@/components/dashboard/ModulesProvider";

const brandPresets = ["#292929", "#7C3AED", "#059669", "#DC2626", "#EA580C"];

function hashCell(x: number, y: number, seed: number) {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) % 100 < 42;
}

/** QR demostrativo (no escaneable): patrón determinista + marcos. */
function QrMock({ seed, color }: { seed: number; color: string }) {
  const cells = useMemo(() => {
    const grid: boolean[][] = [];
    for (let y = 0; y < 21; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < 21; x++) {
        const inFinder =
          (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
        row.push(inFinder ? false : hashCell(x, y, seed));
      }
      grid.push(row);
    }
    return grid;
  }, [seed]);

  const finder = (ox: number, oy: number) => (
    <g transform={`translate(${ox * 10},${oy * 10})`}>
      <rect width="70" height="70" fill={color} />
      <rect x="10" y="10" width="50" height="50" fill="white" />
      <rect x="20" y="20" width="30" height="30" fill={color} />
    </g>
  );

  return (
    <svg viewBox="0 0 210 210" className="w-44 h-44" role="img" aria-label="Código QR de demostración">
      <rect width="210" height="210" fill="white" />
      {cells.map((row, y) =>
        row.map((on, x) =>
          on ? <rect key={`${x}-${y}`} x={x * 10} y={y * 10} width="10" height="10" fill={color} /> : null,
        ),
      )}
      {finder(0, 0)}
      {finder(14, 0)}
      {finder(0, 14)}
    </svg>
  );
}

export function SiteView() {
  const { notify } = useModules();
  const [domain, setDomain] = useState("www.mirestaurante.com");
  const [brand, setBrand] = useState(brandPresets[0]);

  const downloadQr = () => {
    const svg = document.getElementById("fogoneria-qr-svg")?.outerHTML;
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qr-carta-digital.svg";
    a.click();
    URL.revokeObjectURL(url);
    notify("QR descargado", "El código QR de tu carta digital se descargó en SVG.");
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4 animate-[fadeIn_0.3s_ease-out]">
      {/* Dominio */}
      <div className="bg-surface rounded-2xl border border-ink-900/10 overflow-hidden">
        <div className="px-4 py-4 border-b border-ink-900/[0.06]">
          <h2 className="text-sm font-medium text-ink-900">Dominio</h2>
          <p className="text-nav text-ink-400 mt-0.5">La dirección pública de tu sitio web.</p>
        </div>
        <form
          className="p-4 flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            notify("Dominio actualizado", `Tu sitio ahora responde en ${domain}.`);
          }}
        >
          <TextInput
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="flex-1"
          />
          <Button type="submit">
            Guardar dominio
          </Button>
        </form>
      </div>

      {/* Colores de marca */}
      <div className="bg-surface rounded-2xl border border-ink-900/10 overflow-hidden">
        <div className="px-4 py-4 border-b border-ink-900/[0.06]">
          <h2 className="text-sm font-medium text-ink-900">Colores de marca</h2>
          <p className="text-nav text-ink-400 mt-0.5">Se aplican a tu landing y carta digital.</p>
        </div>
        <div className="p-4 flex items-center gap-3">
          {brandPresets.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setBrand(c)}
              aria-label={`Color ${c}`}
              style={{ background: c }}
              className={`w-10 h-10 rounded-full transition-all cursor-pointer ${
                brand === c ? "ring-2 ring-offset-2 ring-primary" : "hover:scale-105"
              }`}
            />
          ))}
          <div className="ml-2 flex items-center gap-2 px-4 h-10 rounded-full text-sm font-medium text-white" style={{ background: brand }}>
            Vista previa
          </div>
        </div>
      </div>

      {/* QR */}
      <div className="bg-surface rounded-2xl border border-ink-900/10 overflow-hidden">
        <div className="px-4 py-4 border-b border-ink-900/[0.06]">
          <h2 className="text-sm font-medium text-ink-900">Código QR de tu carta</h2>
          <p className="text-nav text-ink-400 mt-0.5">Imprímelo y colócalo en cada mesa.</p>
        </div>
        <div className="p-4 flex flex-col sm:flex-row items-center gap-6">
          <div id="fogoneria-qr-svg" className="border border-ink-900/10 rounded-2xl p-3">
            <QrMock seed={domain.length * 7 + 3} color={brand} />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-sm font-medium text-ink-900 mb-1">{domain}/carta</p>
            <p className="text-nav text-ink-400 mb-4">Apunta directo a tu carta digital.</p>
            <Button
              type="button"
              onClick={downloadQr}
              className="gap-2"
            >
              <Download size={14} />
              Descargar QR
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
