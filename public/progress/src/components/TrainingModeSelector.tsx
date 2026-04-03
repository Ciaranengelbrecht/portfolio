import { useState, useRef, useEffect, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { clsx } from "clsx";
import type { TrainingMode } from "../lib/types";
import { MODE_CONFIG } from "./TrainingModeBadge";

interface TrainingModeSelectorProps {
  value: TrainingMode | undefined;
  onChange: (mode: TrainingMode) => void;
  disabled?: boolean;
  className?: string;
}

const MODES: TrainingMode[] = ["bulk", "cut", "maintenance"];

/**
 * Dropdown selector for choosing the current training mode
 * Changes persist and apply to all future sessions until changed again
 */
export default function TrainingModeSelector({
  value,
  onChange,
  disabled,
  className,
}: TrainingModeSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Record<TrainingMode, HTMLButtonElement | null>>({
    bulk: null,
    cut: null,
    maintenance: null,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside as any);
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside as any);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const focusOption = (mode: TrainingMode) => {
    const node = optionRefs.current[mode];
    if (!node) return;
    node.focus({ preventScroll: true });
  };

  const selectedMode = value && MODES.includes(value) ? value : MODES[0];

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      const startMode = event.key === "ArrowUp" ? MODES[MODES.length - 1] : selectedMode;
      requestAnimationFrame(() => focusOption(startMode));
    }
  };

  const handleOptionKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    mode: TrainingMode
  ) => {
    const currentIndex = MODES.indexOf(mode);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(MODES[(currentIndex + 1) % MODES.length]);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(MODES[(currentIndex - 1 + MODES.length) % MODES.length]);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusOption(MODES[0]);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusOption(MODES[MODES.length - 1]);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    }
  };

  const currentConfig = value ? MODE_CONFIG[value] : null;

  return (
    <div ref={containerRef} className={clsx("relative inline-block", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        className={clsx(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
          "border backdrop-blur-sm",
          currentConfig
            ? [currentConfig.bg, currentConfig.border, currentConfig.text]
            : [
                "bg-slate-800/50",
                "border-slate-600/50",
                "text-slate-300",
              ],
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:brightness-110 active:scale-[0.98]"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {currentConfig ? (
          <>
            <span className="text-base">{currentConfig.icon}</span>
            <span>{currentConfig.label}</span>
          </>
        ) : (
          <>
            <span className="text-base opacity-50">○</span>
            <span className="text-slate-400">Set Mode</span>
          </>
        )}
        <svg
          className={clsx(
            "h-4 w-4 transition-transform ml-1",
            open && "rotate-180"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div
          className={clsx(
            "absolute z-50 mt-1 w-full min-w-[140px] rounded-lg",
            "bg-slate-800/95 backdrop-blur-md border border-slate-600/50",
            "shadow-xl shadow-black/30",
            "animate-in fade-in-0 zoom-in-95 duration-150"
          )}
          role="listbox"
        >
          {MODES.map((mode) => {
            const config = MODE_CONFIG[mode];
            const isSelected = value === mode;
            return (
              <button
                ref={(node) => {
                  optionRefs.current[mode] = node;
                }}
                key={mode}
                type="button"
                onClick={() => {
                  onChange(mode);
                  setOpen(false);
                  triggerRef.current?.focus({ preventScroll: true });
                }}
                onKeyDown={(event) => handleOptionKeyDown(event, mode)}
                className={clsx(
                  "flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  "first:rounded-t-lg last:rounded-b-lg",
                  isSelected
                    ? [config.bg, config.text]
                    : "text-slate-300 hover:bg-slate-700/50"
                )}
                role="option"
                aria-selected={isSelected}
              >
                <span className={clsx("text-base", config.text)}>
                  {config.icon}
                </span>
                <span>{config.label}</span>
                {isSelected && (
                  <svg
                    className="ml-auto h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
