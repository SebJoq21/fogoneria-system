import type { AnchorHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "./cn";

type Common = {
  className?: string;
};

type Props =
  | (Common & HTMLAttributes<HTMLElement> & { as?: "div" | "article" | "section" | "aside"; href?: undefined })
  | (Common & AnchorHTMLAttributes<HTMLAnchorElement> & { as?: undefined; href: string });

/** Tarjeta 16px: p-4, rounded-2xl, jerarquía gris */
export function Card(props: Props) {
  const { className = "", href, as: Tag = "div", ...rest } = props;
  const cls = cn("bg-surface rounded-2xl border border-ink-900/10 p-4", className);
  if (href !== undefined) {
    return (
      <a href={href} className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} />
    );
  }
  return <Tag className={cls} {...(rest as HTMLAttributes<HTMLElement>)} />;
}
