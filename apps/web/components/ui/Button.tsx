import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "light" | "danger";

const styles: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary:
    "bg-surface text-ink-900 border border-ink-900/15 hover:border-ink-900 hover:bg-primary-hover/[0.04]",
  ghost: "text-ink-600 hover:text-ink-900 hover:bg-primary-hover/[0.04]",
  light:
    "bg-surface/10 text-white border border-white/20 backdrop-blur-sm hover:bg-surface/20",
  danger: "bg-persimmon-600 text-white hover:bg-persimmon-700",
};

type Common = {
  variant?: Variant;
  className?: string;
};

type Props =
  | (Common & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined })
  | (Common & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string });

const base =
  "inline-flex items-center justify-center rounded-full px-5 h-10 text-sm font-medium tracking-[-0.15px] transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

export function Button(props: Props) {
  const { variant = "primary", className = "", href, ...rest } = props;
  const cls = cn(base, styles[variant], className);
  if (href !== undefined) {
    return (
      <a href={href} className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} />
    );
  }
  return <button className={cls} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)} />;
}
