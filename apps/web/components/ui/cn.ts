import { twMerge } from "tailwind-merge";

/** Une clases con resolución de conflictos (patrón shadcn `cn`). */
export function cn(...inputs: (string | undefined | false)[]): string {
  return twMerge(inputs.filter(Boolean).join(" "));
}
