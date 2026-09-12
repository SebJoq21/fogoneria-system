/** Fila de cabecera de vista: info a la izquierda, acción a la derecha. */
export function Toolbar({
  left,
  right,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <div className="text-sm text-ink-400">{left}</div>
      {right}
    </div>
  );
}
