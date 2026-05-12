"use client";
import { cn } from "@akashnetwork/ui/utils";
import { Wallet } from "iconoir-react";

type WalletLogoProps = {
  src?: string;
  alt: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const SIZE_CLASS: Record<NonNullable<WalletLogoProps["size"]>, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16"
};

export function WalletLogo({ src, alt, size = "md", className }: WalletLogoProps) {
  return (
    <div className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/5 ring-1 ring-black/5 dark:ring-white/10", SIZE_CLASS[size], className)}>
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-contain" />
      ) : (
        <Wallet className="text-muted-foreground h-1/2 w-1/2" />
      )}
    </div>
  );
}