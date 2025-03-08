import React from "react";
import { motion } from "framer-motion";

const variants = {
  default: { width: 0 },
  active: { width: "calc(100% - 0.75rem)" },
};

const TabButton = ({ active, selectTab, children }) => {
  const buttonClasses = active
    ? "text-primary-500 font-semibold"
    : "text-[#ADB7BE] hover:text-primary-400";

  return (
    <button onClick={selectTab} className={`${buttonClasses} mr-6 relative`}>
      <span className="text-lg">{children}</span>
      <motion.div
        animate={active ? "active" : "default"}
        variants={variants}
        className="h-1 rounded-full bg-primary-500 mt-2 absolute bottom-[-6px] left-0"
        transition={{ duration: 0.3 }}></motion.div>
    </button>
  );
};

export default TabButton;
