"use client";

import React, { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { useInView } from "react-intersection-observer";

const stats = [
  { label: "Years Experience", value: "4+" },
  { label: "Supported Users", value: "1,300+" },
  { label: "Classrooms Supported", value: "50+" },
  { label: "Certifications & Checks", value: "3+" },
];

const interests = [
  "ICT Support",
  "Desktop & Endpoint Support",
  "Systems Administration",
  "Automation & Scripting",
];

const tabs = [
  {
    title: "Education",
    id: "education",
    records: [
      {
        range: "2021 - 2025",
        title: "Bachelor of Science - Computer Science",
        org: "University of Western Australia",
        notes: [
          "Computer science degree completed in 2025 with practical project work across software, data, systems, and algorithms.",
          "Built applied experience through web applications, OCR tooling, systems programming, networking, and AI/search projects.",
        ],
      },
      {
        range: "2017 - 2020",
        title: "Bachelor of Science - Registered Nursing",
        org: "Edith Cowan University",
        notes: [
          "Built a strong foundation in communication, professional practice, documentation, privacy, and structured problem solving.",
          "Experience remains useful when supporting staff, students, and stakeholders in service-focused ICT environments.",
        ],
      },
    ],
  },
  {
    title: "Certifications",
    id: "certifications",
    records: [
      {
        range: "N10-009",
        title: "CompTIA Network+",
        org: "CompTIA",
        notes: ["Networking fundamentals, troubleshooting, infrastructure, and operational security."],
      },
      {
        range: "Certified",
        title: "Introduction to Data Science",
        org: "Cisco",
        notes: ["Data concepts, analytics fundamentals, and practical use of data in technical environments."],
      },
      {
        range: "Current",
        title: "Working With Children, Police Clearance & Child Protection",
        org: "Western Australia",
        notes: ["Current clearances and training supporting safe work in school and public-sector ICT contexts."],
      },
    ],
  },
  {
    title: "Experience",
    id: "experience",
    records: [
      {
        range: "2026 - Present",
        title: "Graduate ICT Officer",
        org: "WA Health",
        notes: [
          "Enterprise Health Data placement: worked with Snowflake and SQL to validate fact/dimension tables, joins, mappings, source-to-curated logic, and data integrity checks.",
          "Supported SharePoint metadata structure and large list uploads to improve information management, discoverability, and governance.",
          "Data Science / Application Platform placement: contributed to an internal platform using FastAPI, React, TanStack Router/Query, Drizzle ORM, Better Auth/RBAC, SQL, and Git-style workflows.",
          "Assisted with application structure, documentation, security considerations, role-based access, API design concepts, and maintainable technical documentation.",
        ],
      },
      {
        range: "2025 - 2026",
        title: "Graduate ICT Officer - Cyber Security",
        org: "Main Roads Western Australia",
        notes: [
          "Supported cyber security operations in a state government environment with exposure to Microsoft Sentinel, Defender XDR, identity monitoring, access reviews, and Essential Eight uplift.",
          "Developed KQL queries to analyse sign-in activity, MFA issues, error codes, and success/failure trends.",
          "Performed identity and access reviews across privileged accounts, guest accounts, and group memberships to support least privilege and access hygiene.",
          "Built Power BI reporting and automated audit evidence collection using PowerShell and Microsoft Graph API.",
        ],
      },
      {
        range: "2023 - 2025",
        title: "Junior IT Systems Engineer",
        org: "ITDynamics",
        notes: [
          "Provided Level 2 ICT support across managed service and school environments, including full-time onsite support for approximately 1,300 staff and students at Prendiville Catholic College.",
          "Supported BYOD, staff Windows/Mac devices, iPads, classroom AV, Vivi systems, Wi-Fi, printers, Microsoft 365, SharePoint, Teams, Active Directory, Group Policy, Jamf Pro, Jamf School, and Intune exposure.",
          "Assisted with Aruba Central and Cisco environments, including switch/AP support, patching, port changes, VLAN checks, and wireless troubleshooting.",
          "Built a Python OCR utility that reduced manual processing by approximately 90%, and used Power Automate and scripting to improve recurring service desk and business processes.",
        ],
      },
      {
        range: "2021 - 2023",
        title: "IT Help Desk Technician",
        org: "Catholic Education WA (CEWA)",
        notes: [
          "Delivered onsite Level 1 ICT support in a secondary school environment of approximately 1,000 staff and students.",
          "Supported a 1:1 student device program, staff Windows/Mac devices, iPads, classroom AV, Vivi systems, printers, Wi-Fi, account access, software issues, and general troubleshooting.",
          "Assisted with device imaging, deployment, setup, repairs, user onboarding, account support, and classroom technology checks.",
          "Produced user guides and how-to documentation to help staff resolve common ICT issues and reduce repeat support requests.",
        ],
      },
    ],
  },
];

const RecordList = ({ records }) => (
  <div className="space-y-4">
    {records.map((record, index) => (
      <motion.article
        key={`${record.title}-${record.range}`}
        initial={false}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, delay: index * 0.08 }}
        className="ops-panel-plain p-4"
      >
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-accent-300">{record.range}</p>
            <h4 className="mt-1 text-lg font-semibold text-white">{record.title}</h4>
            <p className="text-sm font-medium text-primary-300">{record.org}</p>
          </div>
          <span className="w-fit rounded-full border border-white/10 px-2.5 py-1 text-xs uppercase text-primary-300">
            item {String(index + 1).padStart(2, "0")}
          </span>
        </div>
        <ul className="space-y-2">
          {record.notes.map((note) => (
            <li key={note} className="flex gap-2 text-sm leading-relaxed text-primary-100">
              <span className="mt-0.5 text-accent-300">-</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </motion.article>
    ))}
  </div>
);

const AboutSection = () => {
  const [tab, setTab] = useState("education");
  const [, startTransition] = useTransition();
  const controls = useAnimation();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  useEffect(() => {
    if (inView) {
      controls.start("visible");
    }
  }, [controls, inView]);

  const currentTab = tabs.find((item) => item.id === tab) || tabs[0];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
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
      id="about"
      initial={false}
      animate={controls}
      variants={containerVariants}
      className="ops-section text-white"
    >
      <div className="ops-container">
        <motion.div variants={itemVariants} className="mb-8 max-w-3xl sm:mb-10">
          <span className="ops-label">About me</span>
          <h2 className="ops-heading mt-4">About me</h2>
          <div className="ops-rule mt-5" />
        </motion.div>

        <div className="grid gap-6 sm:gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10">
          <motion.div variants={itemVariants} className="space-y-4 sm:space-y-5">
            <div className={`ops-panel p-4 sm:p-6 ${inView ? "motion-soft-rise" : ""}`}>
              <p className="ops-kicker mb-3">Professional profile</p>
              <h3 className="text-xl font-semibold text-white sm:text-2xl">Hello, I&apos;m Ciaran</h3>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-primary-100 sm:mt-5 sm:space-y-4 sm:text-base">
                <p>
                  I&apos;m an <span className="text-accent-200">ICT professional</span> based in Perth,
                  Australia, with experience across school ICT, managed services, government cyber security,
                  and WA Health ICT environments.
                </p>
                <p>
                  My core background is practical support and administration: Level 1-2 service delivery,
                  Microsoft 365, Windows/macOS/iPad support, Active Directory, Group Policy, Jamf, user access,
                  classroom technology, Wi-Fi, printers, AV, documentation, and structured troubleshooting.
                </p>
                <p>
                  Development and automation are still a strong interest. I use PowerShell, Python, SQL,
                  Power Automate, Microsoft Graph, Power BI, FastAPI, and React/TanStack work to build tools,
                  reporting, and internal systems that improve everyday ICT operations.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 sm:mt-6">
                {interests.map((interest) => (
                  <span key={interest} className="ops-chip">
                    {interest}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {stats.map((stat) => (
                <motion.div
                  key={stat.label}
                  variants={itemVariants}
                  whileHover={{ y: -4 }}
                  className={`ops-panel-plain p-3.5 sm:p-4 ${inView ? "motion-soft-rise" : ""}`}
                >
                  <div className="text-xl font-semibold text-white sm:text-2xl">{stat.value}</div>
                  <div className="mt-1 text-xs text-primary-300">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-4">
            <div className="mobile-scroll-row flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {tabs.map((tabData) => (
                <button
                  key={tabData.id}
                  onClick={() => startTransition(() => setTab(tabData.id))}
                  className={`filter-pill ${
                    tab === tabData.id
                      ? "filter-pill-active border-accent-400/45 bg-accent-400/10 text-accent-100"
                      : "border-white/10 bg-white/[0.03] text-primary-300 hover:border-primary-300/40 hover:text-white"
                  }`}
                >
                  {tabData.title}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className={`ops-panel p-4 sm:p-5 ${inView ? "motion-soft-rise" : ""}`}
              >
                <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <p className="ops-kicker">Background</p>
                    <h3 className="text-xl font-semibold text-white">{currentTab.title}</h3>
                  </div>
                  <span className="text-xs text-primary-400">{currentTab.records.length} items</span>
                </div>
                <RecordList records={currentTab.records} />
              </motion.div>
            </AnimatePresence>

            <a
              href="/images/Curriculum Vitae - Ciaran Engelbrecht website.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="ops-button w-full sm:w-auto"
            >
              Download resume
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </a>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
};

export default AboutSection;
