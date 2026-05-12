"use client";
import { cn } from "@akashnetwork/ui/utils";
import { NavArrowLeft, Xmark } from "iconoir-react";

type HeaderProps = {
  title: string;
  onClose: () => void;
  onReturn?: () => void;
  className?: string;
};

export function Header({ title, onClose, onReturn, className }: HeaderProps) {
  return (
    <div className={cn("relative flex h-9 items-center justify-between", className)}>
      <div className="w-9">
        {onReturn && (
          <button
            type="button"
            onClick={onReturn}
            aria-label="Back"
            className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          >
            <NavArrowLeft className="h-4 w-4" />
          </button>
        )}
      </div>
      <h2 className="text-foreground text-sm font-semibold tracking-tight">{title}</h2>
      <div className="w-9 text-right">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          data-testid="wallet-modal-close"
          className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors"
        >
          <Xmark className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}