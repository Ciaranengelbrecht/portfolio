"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { useInView } from "react-intersection-observer";

const skillGroups = [
  {
    id: "service",
    name: "ICT Support & Service Delivery",
    summary: "Level 1-2 support, onsite/walk-in service, ticket triage, escalation, documentation, and user-focused troubleshooting.",
    items: ["Incident Triage", "Onsite Support", "Remote Support", "SLA-Aware Support", "ConnectWise", "IT Glue", "ServiceNow Exposure"],
  },
  {
    id: "endpoint",
    name: "Microsoft, Identity & Endpoint",
    summary: "Administration and support across Microsoft 365, identity, endpoint platforms, and mixed Windows, macOS, and iPad environments.",
    items: ["Microsoft 365", "Teams", "SharePoint", "Active Directory", "Group Policy", "Entra ID Exposure", "Jamf Pro", "Jamf School", "Intune Exposure"],
  },
  {
    id: "school",
    name: "School ICT & End-User Environments",
    summary: "Practical school ICT support across staff, student, BYOD, 1:1 device, classroom AV, printing, Wi-Fi, and learning-space continuity.",
    items: ["Windows", "macOS", "iOS/iPad", "BYOD", "Vivi", "Classroom AV", "Printers", "1:1 Devices"],
  },
  {
    id: "networking",
    name: "Networking & Infrastructure",
    summary: "Network troubleshooting and infrastructure support across wireless, switching, addressing, patching, and escalation workflows.",
    items: ["TCP/IP", "DNS", "DHCP", "VLANs", "Wi-Fi", "Aruba Central", "Cisco Support", "Port Changes", "VPN Concepts"],
  },
  {
    id: "security",
    name: "Security & Governance",
    summary: "Security-aware ICT practice across identity monitoring, access reviews, MFA/sign-in analysis, governance, and audit evidence.",
    items: ["Microsoft Sentinel", "Defender XDR", "KQL", "MFA Analysis", "Access Reviews", "Essential Eight", "Audit Evidence"],
  },
  {
    id: "automation",
    name: "Automation & Data",
    summary: "Workflow automation, reporting, data validation, OCR utilities, and internal tooling that reduce repetitive ICT work.",
    items: ["PowerShell", "Microsoft Graph API", "Power Automate", "Power BI", "Python", "SQL", "Snowflake", "Excel"],
  },
  {
    id: "development",
    name: "Development Projects",
    summary: "Applied software work used for internal tools, dashboards, APIs, personal projects, and automation-heavy problem solving.",
    items: ["FastAPI", "React", "TanStack", "Drizzle ORM", "Better Auth/RBAC", "Git", "SQLite", "TypeScript"],
  },
];

const categories = [
  { id: "all", name: "All" },
  ...skillGroups.map((group) => ({ id: group.id, name: group.name })),
];

const evidence = [
  { label: "ICT support", value: "School ICT, managed services, WA Health, and government environments" },
  { label: "Systems & networks", value: "Microsoft 365, identity, endpoint support, Wi-Fi, VLANs, Aruba/Cisco" },
  { label: "Automation work", value: "OCR tooling, PowerShell/Graph reporting, SQL validation, workflow improvements" },
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
            A practical ICT toolkit built through service desk, school ICT,
            endpoint administration, networking, government security, data,
            and automation-focused project work.
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
