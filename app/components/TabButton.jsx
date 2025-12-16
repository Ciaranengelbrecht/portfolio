import React from "react";
import { motion } from "framer-motion";

const TabButton = ({ active, selectTab, children, icon }) => {
  return (
    <motion.button
      onClick={selectTab}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        relative flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm 
        transition-all duration-300 overflow-hidden
        ${active 
          ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-glow-sm" 
          : "glass border border-white/10 text-slate-400 hover:text-white hover:border-primary-500/50"
        }
      `}
    >
      {/* Shimmer effect on active */}
      {active && (
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "200%" }}
          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
        />
      )}
      
      {icon && <span className="relative z-10">{icon}</span>}
      <span className="relative z-10">{children}</span>
      
      {/* Active indicator dot */}
      {active && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-1 right-1 w-2 h-2 rounded-full bg-white/50"
        />
      )}
    </motion.button>
  );
};

export default TabButton;
