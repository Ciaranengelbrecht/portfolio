import { AnimatePresence, motion } from "framer-motion";
import {
  Fragment,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type OptionSheetOption = {
  id: string;
  label: ReactNode;
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
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const lastActive = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const firstEnabledIndex = useMemo(
    () => options.findIndex((option) => !option.disabled),
    [options]
  );
  const selectedEnabledIndex = useMemo(
    () => options.findIndex((option) => option.selected && !option.disabled),
    [options]
  );

  useEffect(() => {
    optionRefs.current = optionRefs.current.slice(0, options.length);
  }, [options.length]);

  useEffect(() => {
    if (!open) return;
    const nextIndex =
      selectedEnabledIndex >= 0 ? selectedEnabledIndex : firstEnabledIndex;
    setActiveIndex(nextIndex);
  }, [open, selectedEnabledIndex, firstEnabledIndex]);

  const focusOption = useCallback((index: number) => {
    if (index < 0) return;
    const node = optionRefs.current[index];
    if (!node) return;
    node.focus({ preventScroll: true });
    node.scrollIntoView({ block: "nearest" });
    setActiveIndex(index);
  }, []);

  const moveActiveIndex = useCallback(
    (direction: 1 | -1) => {
      if (!options.length) return;
      let idx = activeIndex;
      for (let i = 0; i < options.length; i += 1) {
        idx = (idx + direction + options.length) % options.length;
        if (!options[idx]?.disabled) {
          focusOption(idx);
          return;
        }
      }
    },
    [activeIndex, options, focusOption]
  );

  const focusBoundary = useCallback(
    (boundary: "start" | "end") => {
      const indexes =
        boundary === "start"
          ? options.map((_, idx) => idx)
          : options.map((_, idx) => options.length - 1 - idx);
      for (const idx of indexes) {
        if (!options[idx]?.disabled) {
          focusOption(idx);
          break;
        }
      }
    },
    [options, focusOption]
  );

  // Check if click is on empty/background area (not interactive content)
  const handleEmptySpaceClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Don't close if clicking on interactive elements or their children
    const isInteractive = target.closest('button, input, a, [data-option], [role="button"]');
    if (isInteractive) return;
    
    // Don't close if clicking on actual content text
    const isContentText = target.closest('h2, p, span, label');
    if (isContentText) return;
    
    // Don't close if clicking on badges, icons, or trailing elements
    const isDecoration = target.closest('[class*="badge"], [class*="icon"], svg');
    if (isDecoration) return;
    
    // Close for everything else (empty space, containers, backgrounds)
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    lastActive.current = document.activeElement as HTMLElement | null;
    const prevOverflow = body?.style.overflow || "";
    if (body) body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName || "";
      const isTextInput =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;

      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        if (searchRef.current) {
          e.preventDefault();
          searchRef.current.focus({ preventScroll: true });
          searchRef.current.select?.();
        }
        return;
      }

      if (!options.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (isTextInput) {
          const startIndex =
            activeIndex >= 0 ? activeIndex : firstEnabledIndex;
          focusOption(startIndex);
          return;
        }
        moveActiveIndex(1);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (isTextInput) {
          const startIndex =
            activeIndex >= 0 ? activeIndex : firstEnabledIndex;
          focusOption(startIndex);
          return;
        }
        moveActiveIndex(-1);
        return;
      }

      if (isTextInput) return;

      if (e.key === "Home") {
        e.preventDefault();
        focusBoundary("start");
        return;
      }

      if (e.key === "End") {
        e.preventDefault();
        focusBoundary("end");
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
          const targetIndex =
            selectedEnabledIndex >= 0 ? selectedEnabledIndex : firstEnabledIndex;
          const first =
            targetIndex >= 0
              ? optionRefs.current[targetIndex]
              : (node.querySelector("[data-option]") as HTMLElement | null);
          if (first && document.activeElement !== first) {
            first.focus({ preventScroll: true });
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
  }, [
    open,
    initialFocus,
    options.length,
    activeIndex,
    firstEnabledIndex,
    selectedEnabledIndex,
    focusOption,
    moveActiveIndex,
    focusBoundary,
  ]);

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
            onClick={handleEmptySpaceClick}
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
              className="relative z-10 flex w-full max-h-[min(94dvh,calc(100dvh-0.75rem))] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-slate-950/95 shadow-[0_24px_70px_-30px_rgba(15,118,110,0.7)] backdrop-blur-sm sm:max-h-[94vh] sm:max-w-2xl sm:rounded-3xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              initial={{ y: 48, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              onClick={handleEmptySpaceClick}
            >
              {/* Minimal drag handle - tap to close on mobile */}
              <div
                onClick={onClose}
                className="sm:hidden w-full py-2 flex justify-center items-center"
              >
                <div className="w-8 h-1 rounded-full bg-white/20" />
              </div>
              <div 
                className="flex flex-col gap-4 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[max(0.25rem,env(safe-area-inset-top))] sm:pb-5 sm:pt-5"
                onClick={handleEmptySpaceClick}
              >
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
                  role="listbox"
                  aria-label={title}
                  className="relative -mx-2 flex-1 overscroll-contain px-2 pb-2 pt-2"
                  style={{
                    maxHeight: `min(70dvh, ${maxListHeight}px)`,
                    overflowY: "auto",
                    WebkitOverflowScrolling: "touch",
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgba(255,255,255,0.15) transparent",
                    scrollPaddingBottom: "1rem",
                  }}
                  onClick={handleEmptySpaceClick}
                >
                  <div className="pointer-events-none absolute inset-x-2 top-0 z-10 h-5 bg-gradient-to-b from-slate-950/95 to-transparent" />
                  <div className="pointer-events-none absolute inset-x-2 bottom-0 z-10 h-8 bg-gradient-to-t from-slate-950/95 to-transparent" />
                  <div className="relative space-y-2 pb-6" onClick={handleEmptySpaceClick}>
                    {options.length === 0 && emptyState}
                    {options.map((option, idx) => (
                      <Fragment key={option.id}>
                        <button
                          ref={(node) => {
                            optionRefs.current[idx] = node;
                          }}
                          data-option
                          type="button"
                          disabled={option.disabled}
                          role="option"
                          aria-selected={option.selected}
                          onFocus={() => setActiveIndex(idx)}
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
    handleEmptySpaceClick,
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
