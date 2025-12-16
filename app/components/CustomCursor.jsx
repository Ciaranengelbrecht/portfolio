"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, useSpring, useMotionValue } from "framer-motion";

const CustomCursor = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [cursorType, setCursorType] = useState("default");
  const [cursorText, setCursorText] = useState("");

  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const ringX = useMotionValue(-100);
  const ringY = useMotionValue(-100);

  const springConfig = { damping: 30, stiffness: 400 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);
  
  const ringSpringConfig = { damping: 20, stiffness: 200 };
  const ringXSpring = useSpring(ringX, ringSpringConfig);
  const ringYSpring = useSpring(ringY, ringSpringConfig);

  const handleMouseMove = useCallback((e) => {
    cursorX.set(e.clientX);
    cursorY.set(e.clientY);
    ringX.set(e.clientX);
    ringY.set(e.clientY);
  }, [cursorX, cursorY, ringX, ringY]);

  const handleMouseEnter = useCallback(() => setIsVisible(true), []);
  const handleMouseLeave = useCallback(() => setIsVisible(false), []);

  useEffect(() => {
    const handleMouseOver = (e) => {
      const target = e.target;
      
      // Check for interactive elements
      if (target.tagName === "A" || target.closest("a")) {
        setCursorType("link");
        const text = target.getAttribute("data-cursor-text") || target.closest("a")?.getAttribute("data-cursor-text");
        setCursorText(text || "");
      } else if (target.tagName === "BUTTON" || target.closest("button")) {
        setCursorType("button");
        setCursorText("");
      } else if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        setCursorType("text");
        setCursorText("");
      } else if (target.getAttribute("data-cursor") === "project") {
        setCursorType("project");
        setCursorText("View");
      } else {
        setCursorType("default");
        setCursorText("");
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseenter", handleMouseEnter);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseover", handleMouseOver);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseenter", handleMouseEnter);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseover", handleMouseOver);
    };
  }, [handleMouseMove, handleMouseEnter, handleMouseLeave]);

  // Hide on touch devices
  if (typeof window !== "undefined" && "ontouchstart" in window) {
    return null;
  }

  const getCursorSize = () => {
    switch (cursorType) {
      case "link":
        return { dot: 6, ring: 50 };
      case "button":
        return { dot: 0, ring: 60 };
      case "text":
        return { dot: 2, ring: 30 };
      case "project":
        return { dot: 0, ring: 80 };
      default:
        return { dot: 8, ring: 36 };
    }
  };

  const sizes = getCursorSize();

  return (
    <>
      {/* Main cursor dot */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference hidden md:block"
        style={{
          x: cursorXSpring,
          y: cursorYSpring,
          translateX: "-50%",
          translateY: "-50%",
        }}
        animate={{
          width: sizes.dot,
          height: sizes.dot,
          opacity: isVisible ? 1 : 0,
        }}
        transition={{ duration: 0.15 }}
      >
        <div className="w-full h-full rounded-full bg-white" />
      </motion.div>

      {/* Cursor ring */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9998] hidden md:flex items-center justify-center"
        style={{
          x: ringXSpring,
          y: ringYSpring,
          translateX: "-50%",
          translateY: "-50%",
        }}
        animate={{
          width: sizes.ring,
          height: sizes.ring,
          opacity: isVisible ? 1 : 0,
          borderWidth: cursorType === "project" ? 2 : 1.5,
        }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className={`w-full h-full rounded-full border transition-colors duration-200 ${
            cursorType === "link" || cursorType === "button"
              ? "border-primary-400 bg-primary-400/10"
              : cursorType === "project"
              ? "border-white bg-white/10"
              : "border-white/50"
          }`}
          animate={{
            scale: cursorType === "button" ? [1, 0.9, 1] : 1,
          }}
          transition={{
            scale: { repeat: cursorType === "button" ? Infinity : 0, duration: 0.8 },
          }}
        />
        
        {/* Cursor text for project cards */}
        {cursorText && (
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute text-xs font-medium text-white"
          >
            {cursorText}
          </motion.span>
        )}
      </motion.div>

      {/* Hide default cursor on desktop */}
      <style jsx global>{`
        @media (min-width: 768px) {
          * {
            cursor: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default CustomCursor;