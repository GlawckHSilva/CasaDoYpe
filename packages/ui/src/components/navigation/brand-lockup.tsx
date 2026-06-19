import Link from "next/link";

import { cn } from "../../lib/utils";

export type BrandLockupProps = {
  href?: string;
  label?: string;
  compact?: boolean;
  className?: string;
};

export function BrandLockup({
  href = "/",
  label = "Hospedex",
  compact = false,
  className
}: BrandLockupProps) {
  return (
    <Link className={cn("flex items-center gap-3", className)} href={href}>
      <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-sm font-black text-primary-foreground shadow-sm">
        H
      </span>
      {!compact ? (
        <span className="text-sm font-bold tracking-normal text-foreground">
          {label}
        </span>
      ) : null}
    </Link>
  );
}
