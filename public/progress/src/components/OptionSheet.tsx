import { AnimatePresence, motion } from "framer-motion";
import { Fragment, ReactNode, useEffect, useId, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

export type OptionSheetOption = {
  id: string;
  label: string;
  description?: string;
  hint?: string;
  badge?: ReactNode;
  icon?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  detail?: ReactNode;
};

export interface OptionSheetProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  initialFocus?: "search" | "list";
  options: OptionSheetOption[];
  emptyState?: ReactNode;
  highlight?: ReactNode;
  footer?: ReactNode;
  primaryAction?: { label: string; onClick: () => void };
  maxListHeight?: number;
}

const body = typeof document !== "undefined" ? document.body : null;

export default function OptionSheet({
  open,
  title,
  description,
  onClose,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  initialFocus = "search",
  options,
  emptyState,
  highlight,
  footer,
  primaryAction,
  maxListHeight = 520,
}: OptionSheetProps) {
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const lastActive = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    lastActive.current = document.activeElement as HTMLElement | null;
    const prevOverflow = body?.style.overflow || "";
    if (body) body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current?.();
      }
    };
    document.addEventListener("keydown", handler);
    const focusTarget = initialFocus === "search" ? searchRef : listRef;
    requestAnimationFrame(() => {
      const node = focusTarget.current;
      if (node) {
        if (node instanceof HTMLInputElement) {
          if (document.activeElement !== node) {
            node.focus({ preventScroll: true });
            node.select?.();
          }
        } else {
          const first = node.querySelector(
            "[data-option]"
          ) as HTMLElement | null;
          if (first && document.activeElement !== first) {
            first.focus();
          }
        }
      }
    });
    return () => {
      document.removeEventListener("keydown", handler);
      if (body) body.style.overflow = prevOverflow;
      lastActive.current?.focus?.({ preventScroll: true });
      lastActive.current = null;
    };
  }, [open, initialFocus]);

  const content = useMemo(() => {
    if (!open) return null;
    return (
      <AnimatePresence>
        {open ? (
          <motion.div
            key="option-sheet"
            className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={onClose}
            />
            <motion.div
              className="relative z-10 w-full max-h-[92vh] overflow-hidden rounded-t-3xl border border-white/10 bg-slate-950/95 backdrop-blur-sm shadow-[0_24px_70px_-30px_rgba(15,118,110,0.7)] sm:max-w-2xl sm:rounded-3xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              initial={{ y: 48, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 34 }}
            >
              <div className="flex flex-col gap-4 p-5">
                <header className="flex flex-col gap-2 pr-8">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2
                        id={titleId}
                        className="text-lg font-semibold text-white"
                      >
                        {title}
                      </h2>
                      {description ? (
                        <p className="mt-1 text-sm text-slate-300/80">
                          {description}
                        </p>
                      ) : null}
                    </div>
                    <button
                      className="shrink-0 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/80 transition hover:bg-white/20 hover:text-white"
                      onClick={onClose}
                    >
                      Close
                    </button>
                  </div>
                  {onSearchChange ? (
                    <label className="block text-xs font-medium uppercase tracking-[0.3em] text-white/40">
                      {searchLabel || "Search"}
                      <input
                        ref={searchRef}
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                        placeholder={searchPlaceholder}
                        value={searchValue}
                        onChange={(e) => onSearchChange?.(e.target.value)}
                        type="search"
                        spellCheck={false}
                      />
                    </label>
                  ) : null}
                  {highlight}
                </header>
                <div
                  ref={listRef}
                  tabIndex={-1}
                  className="relative -mx-2 flex-1 overflow-y-auto px-2 pb-2"
                  style={{ maxHeight: `min(68vh, ${maxListHeight}px)` }}
                >
                  <div className="pointer-events-none absolute inset-x-2 top-0 h-4 bg-gradient-to-b from-slate-950/95 to-transparent" />
                  <div className="pointer-events-none absolute inset-x-2 bottom-0 h-6 bg-gradient-to-t from-slate-950/95 to-transparent" />
                  <div className="relative space-y-2 pb-4">
                    {options.length === 0 && emptyState}
                    {options.map((option) => (
                      <Fragment key={option.id}>
                        <button
                          data-option
                          type="button"
                          disabled={option.disabled}
                          onClick={() => {
                            if (option.disabled) return;
                            option.onSelect();
                          }}
                          className={`group w-full rounded-2xl border border-white/10 px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-0 ${
                            option.selected
                              ? "border-emerald-400/60 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(16,185,129,0.45)]"
                              : "bg-white/5 hover:border-white/20 hover:bg-white/10"
                          } ${option.disabled ? "opacity-50" : ""}`}
                        >
                          <div className="flex items-start gap-3">
                            {option.icon ? (
                              <div className="mt-0.5 text-white/80">
                                {option.icon}
                              </div>
                            ) : null}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-base font-medium text-white">
                                  {option.label}
                                </span>
                                {option.badge ? (
                                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white/70">
                                    {option.badge}
                                  </span>
                                ) : null}
                              </div>
                              {option.description ? (
                                <p className="mt-1 text-sm text-white/70">
                                  {option.description}
                                </p>
                              ) : null}
                              {option.hint ? (
                                <p className="mt-1 text-xs uppercase tracking-[0.25em] text-white/40">
                                  {option.hint}
                                </p>
                              ) : null}
                              {option.detail ? (
                                <div className="mt-3 space-y-1 text-sm text-white/80">
                                  {option.detail}
                                </div>
                              ) : null}
                            </div>
                            {option.trailing ? (
                              <div className="text-xs text-white/60">
                                {option.trailing}
                              </div>
                            ) : null}
                          </div>
                        </button>
                      </Fragment>
                    ))}
                  </div>
                </div>
                {primaryAction ? (
                  <button
                    type="button"
                    className="rounded-2xl border border-emerald-400/40 bg-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/30"
                    onClick={primaryAction.onClick}
                  >
                    {primaryAction.label}
                  </button>
                ) : null}
                {footer}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    );
  }, [
    open,
    onClose,
    title,
    description,
    searchValue,
    onSearchChange,
    searchPlaceholder,
    searchLabel,
    highlight,
    options,
    emptyState,
    primaryAction,
    footer,
    maxListHeight,
  ]);

  if (!body) return null;
  return createPortal(content, body);
}
