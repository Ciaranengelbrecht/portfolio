"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { useInView } from "react-intersection-observer";

const skillGroups = [
  {
    id: "software",
    name: "Software Development",
    summary: "Web applications, full-stack projects, scripting, and practical software tools.",
    items: ["Python", "JavaScript", "TypeScript", "React", "Next.js", "Flask"],
  },
  {
    id: "ict",
    name: "ICT & Systems",
    summary: "Hands-on experience supporting users, administering platforms, and improving day-to-day operations.",
    items: ["Microsoft 365", "SharePoint", "Active Directory", "JAMF", "Windows/macOS", "IT Documentation"],
  },
  {
    id: "automation",
    name: "Automation & Data",
    summary: "Workflow automation, reporting, data extraction, and lightweight AI/data science projects.",
    items: ["PowerShell", "GraphAPI", "SQL", "OCR", "Python Automation", "AI/ML"],
  },
  {
    id: "networking",
    name: "Networking & Security",
    summary: "Networking, access management, monitoring, and security-aware ICT support.",
    items: ["Aruba/Cisco", "VLANs", "Microsoft Sentinel", "KQL", "MFA", "Essential Eight"],
  },
  {
    id: "tools",
    name: "Tools",
    summary: "Development and platform tools used to build, test, deploy, and maintain projects.",
    items: ["Git", "Vite", "Tailwind", "IndexedDB", "SQLite", "Linux"],
  },
];

const categories = [
  { id: "all", name: "All" },
  ...skillGroups.map((group) => ({ id: group.id, name: group.name })),
];

const evidence = [
  { label: "Software projects", value: "LiftLog PWA, TaskHub, portfolio systems" },
  { label: "ICT experience", value: "Support, systems administration, networking, documentation" },
  { label: "Automation work", value: "OCR tooling, reporting scripts, workflow improvements" },
];

const SkillGroup = ({ group, index, isVisible }) => (
  <motion.article
    initial={false}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, delay: index * 0.08 }}
    className={`ops-panel ops-card-hover p-4 sm:p-5 ${isVisible ? "motion-soft-rise" : ""}`}
  >
    <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4 sm:gap-4">
      <div>
        <h3 className="text-lg font-semibold text-white sm:text-xl">{group.name}</h3>
      </div>
      <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-primary-300">
        {group.items.length} skills
      </span>
    </div>
    <p className="mb-4 text-sm leading-relaxed text-primary-100 sm:mb-5">{group.summary}</p>
    <div className="flex flex-wrap gap-2">
      {group.items.map((skill) => (
        <span key={skill} className="ops-chip">
          {skill}
        </span>
      ))}
    </div>
  </motion.article>
);

const SkillsSection = () => {
  const [category, setCategory] = useState("all");
  const controls = useAnimation();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  useEffect(() => {
    if (inView) {
      controls.start("visible");
    }
  }, [controls, inView]);

  const visibleGroups =
    category === "all" ? skillGroups : skillGroups.filter((group) => group.id === category);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, ease: [0.25, 0.1, 0.25, 1] },
    },
  };

  return (
    <motion.section
      ref={ref}
      id="skills"
      initial={false}
      animate={controls}
      variants={containerVariants}
      className="ops-section"
    >
      <div className="ops-container">
        <motion.div variants={itemVariants} className="mb-8 max-w-3xl sm:mb-10">
          <span className="ops-label">Skills overview</span>
          <h2 className="ops-heading mt-4">Skills</h2>
          <p className="mt-4 max-w-2xl text-primary-100">
            A practical toolkit built through hands-on project work,
            from low-level systems programming to modern web development.
          </p>
          <div className="ops-rule mt-5" />
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="mobile-scroll-row mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide sm:mb-8"
        >
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`filter-pill ${
                category === cat.id
                  ? "filter-pill-active border-accent-400/45 bg-accent-400/10 text-accent-100"
                  : "border-white/10 bg-white/[0.03] text-primary-300 hover:border-primary-300/40 hover:text-white"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={category}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2"
          >
            {visibleGroups.map((group, index) => (
              <SkillGroup key={group.id} group={group} index={index} isVisible={inView} />
            ))}
          </motion.div>
        </AnimatePresence>

        <motion.div variants={itemVariants} className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 lg:grid-cols-3">
          {evidence.map((item) => (
            <div key={item.label} className="ops-panel-plain p-4">
              <p className="text-xs font-semibold uppercase text-warm-300">{item.label}</p>
              <p className="mt-2 text-sm text-primary-100">{item.value}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
};

export default SkillsSection;
