"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { useInView } from "react-intersection-observer";
import Link from "next/link";

const projectsData = [
  {
    id: 1,
    title: "Macro Scanner",
    description:
      "ICT/security support utility for triaging macro-enabled Office documents with heuristic analysis, Defender integration, and browser-based batch processing.",
    tag: ["All", "Security", "Automation"],
    gitUrl: "https://github.com/Ciaranengelbrecht/macro-scanner",
    previewUrl: "https://github.com/Ciaranengelbrecht/macro-scanner",
    tech: ["JavaScript", "Python", "PowerShell", "Security"],
    featured: true,
  },
  {
    id: 2,
    title: "LiftLog - Gym Progress Tracker",
    description:
      "Offline-first PWA showing practical full-stack product work: local-first data handling, guided setup, sync, recovery modelling, and mobile-focused UX.",
    tag: ["All", "Web"],
    gitUrl: "https://github.com/Ciaranengelbrecht/portfolio",
    previewUrl: "https://ciaranengelbrecht.com/progress",
    tech: ["React", "TypeScript", "Vite", "IndexedDB", "PWA"],
    featured: true,
    hasDemo: true,
  },
  {
    id: 3,
    title: "TaskHub Web App",
    description:
      "Full-stack task management platform with authentication, collaboration workflows, and a structured UI for team productivity.",
    tag: ["All", "Web"],
    gitUrl: "https://github.com/Ciaranengelbrecht/CITS3403-TaskHub-Web-Project",
    previewUrl: "https://taskhub.ciaranengelbrecht.com",
    tech: ["JavaScript", "Flask", "Python", "SQLite"],
    featured: true,
    hasDemo: true,
  },
  {
    id: 4,
    title: "Super Mario ML Speedrun",
    description:
      "Reinforcement learning AI that learns to speedrun Super Mario Bros using neural networks and evolutionary algorithms.",
    tag: ["All", "AI"],
    gitUrl: "https://github.com/Ciaranengelbrecht/Super-Mario-Bros-ML-AI-Speedrun",
    previewUrl: "https://github.com/Ciaranengelbrecht/Super-Mario-Bros-ML-AI-Speedrun",
    tech: ["Python", "TensorFlow", "OpenAI Gym"],
    featured: true,
  },
  {
    id: 5,
    title: "OCR Table Detection",
    description:
      "Document automation project for detecting tables in PDFs/images and converting manual document processing into structured data outputs.",
    tag: ["All", "AI", "Automation"],
    gitUrl: "https://github.com/Ciaranengelbrecht/OCR-Table-Detection-and-PDF-conversion-Project",
    previewUrl: "https://github.com/Ciaranengelbrecht/OCR-Table-Detection-and-PDF-conversion-Project",
    tech: ["Python", "OpenCV", "Tesseract"],
  },
  {
    id: 6,
    title: "Ontology Knowledge System",
    description:
      "Semantic web project implementing knowledge representation using ontologies and reasoning systems with SPARQL queries.",
    tag: ["All", "Web"],
    gitUrl: "https://github.com/Ciaranengelbrecht/CITS3005-Ontology-Project",
    previewUrl: "https://github.com/Ciaranengelbrecht/CITS3005-Ontology-Project",
    tech: ["OWL", "SPARQL", "Semantic Web"],
  },
  {
    id: 7,
    title: "Document OCR Pipeline",
    description:
      "End-to-end OCR pipeline for extracting and processing text from scanned documents, supporting the same automation mindset used in ICT operations.",
    tag: ["All", "AI", "Automation"],
    gitUrl: "https://github.com/Ciaranengelbrecht/CITS3200-OCR-Project",
    previewUrl: "https://github.com/Ciaranengelbrecht/CITS3200-OCR-Project",
    tech: ["Python", "PyTorch", "Image Processing"],
  },
  {
    id: 8,
    title: "PDF Subject Splitter",
    description:
      "Automated tool for splitting large PDF documents by subject markers, streamlining document organization workflows.",
    tag: ["All", "Automation", "Utility"],
    gitUrl: "https://github.com/Ciaranengelbrecht/subject-selection-splitter",
    previewUrl: "https://github.com/Ciaranengelbrecht/subject-selection-splitter",
    tech: ["Python", "PyPDF2"],
  },
  {
    id: 9,
    title: "Systems Programming Suite",
    description:
      "Collection of low-level systems programming projects exploring memory management, processes, and OS concepts.",
    tag: ["All", "Systems"],
    gitUrl: "https://github.com/Ciaranengelbrecht/Systems-Programming",
    previewUrl: "https://github.com/Ciaranengelbrecht/Systems-Programming",
    tech: ["C", "Linux", "POSIX"],
  },
  {
    id: 10,
    title: "Data Structures & Algorithms",
    description:
      "Comprehensive implementation of classic data structures and algorithms with performance analysis for CITS2200.",
    tag: ["All", "Algorithms"],
    gitUrl: "https://github.com/Ciaranengelbrecht/Data-Structures-and-Algorithms",
    previewUrl: "https://github.com/Ciaranengelbrecht/Data-Structures-and-Algorithms",
    tech: ["Java", "Algorithms", "DSA"],
  },
  {
    id: 11,
    title: "AI Agents & Search",
    description:
      "Multi-agent systems and AI search algorithms for solving complex problems through collaborative artificial intelligence.",
    tag: ["All", "AI"],
    gitUrl: "https://github.com/Ciaranengelbrecht/Algorithms-Agents-and-AI",
    previewUrl: "https://github.com/Ciaranengelbrecht/Algorithms-Agents-and-AI",
    tech: ["Python", "Multi-Agent", "Search"],
  },
  {
    id: 12,
    title: "Network Server Engine",
    description:
      "Custom network server project implementing TCP/IP concepts and concurrent connection handling.",
    tag: ["All", "Systems", "Networking"],
    gitUrl: "https://github.com/Ciaranengelbrecht/Networking-Server-Project",
    previewUrl: "https://github.com/Ciaranengelbrecht/Networking-Server-Project",
    tech: ["C", "Sockets", "TCP/IP"],
  },
  {
    id: 13,
    title: "Car Park System",
    description:
      "Automated parking management system with real-time occupancy tracking and reservation capabilities.",
    tag: ["All", "Web"],
    gitUrl: "https://github.com/Ciaranengelbrecht/Car-Park-System",
    previewUrl: "https://github.com/Ciaranengelbrecht/Car-Park-System",
    tech: ["Python", "Flask", "SQLite"],
  },
  {
    id: 14,
    title: "3D Graphics Engine",
    description:
      "OpenGL-based graphics engine featuring real-time rendering, shaders, and animation systems.",
    tag: ["All", "Graphics"],
    gitUrl: "https://github.com/Ciaranengelbrecht/CITS3003_Project_Gaphics-and-Animation",
    previewUrl: "https://github.com/Ciaranengelbrecht/CITS3003_Project_Gaphics-and-Animation",
    tech: ["C++", "OpenGL", "GLSL"],
  },
  {
    id: 15,
    title: "File Duplicate Detector",
    description:
      "Efficient C program to detect and manage duplicate files across directories using hash-based comparison.",
    tag: ["All", "Systems"],
    gitUrl: "https://github.com/Ciaranengelbrecht/C-File-Duplicate-Detector",
    previewUrl: "https://github.com/Ciaranengelbrecht/C-File-Duplicate-Detector",
    tech: ["C", "File Systems", "Hashing"],
  },
  {
    id: 16,
    title: "Java Akari Puzzle",
    description:
      "Interactive Akari (Light Up) puzzle game implementation with solver algorithms and GUI interface.",
    tag: ["All", "Algorithms"],
    gitUrl: "https://github.com/Ciaranengelbrecht/Java-Akari-Puzzle",
    previewUrl: "https://github.com/Ciaranengelbrecht/Java-Akari-Puzzle",
    tech: ["Java", "GUI", "Algorithms"],
  },
];

const categories = ["All", "Automation", "Web", "Networking", "Security", "Systems", "AI", "Algorithms", "Graphics", "Utility"];

const CategoryButton = ({ name, isSelected, onClick, count }) => (
  <button
    onClick={onClick}
    className={`filter-pill flex flex-shrink-0 items-center gap-2 ${
      isSelected
        ? "filter-pill-active border-accent-400/45 bg-accent-400/10 text-accent-100"
        : "border-white/10 bg-white/[0.03] text-primary-300 hover:border-primary-300/40 hover:text-white"
    }`}
  >
    <span>{name}</span>
    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px]">{count}</span>
  </button>
);

const ProjectCard = ({ project, index, isVisible }) => {
  const category = project.tag.find((item) => item !== "All") || "General";

  return (
    <motion.article
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06 }}
      className={`ops-panel ops-card-hover flex h-full flex-col p-4 sm:p-5 ${
        project.featured ? "border-accent-400/25" : ""
      } ${isVisible ? "motion-soft-rise" : ""}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/10 pb-4 sm:gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-accent-300">
            Project {String(project.id).padStart(2, "0")} / {category}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white sm:text-xl">{project.title}</h3>
        </div>
        {project.featured && (
          <span className="rounded-full border border-warm-400/35 bg-warm-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase text-warm-300">
            featured
          </span>
        )}
      </div>

      <p className="mb-4 flex-1 text-sm leading-relaxed text-primary-100 sm:mb-5">{project.description}</p>

      <div className="mb-4 sm:mb-5">
        <p className="mb-2 text-xs font-semibold uppercase text-primary-400">Technologies</p>
        <div className="flex flex-wrap gap-2">
          {project.tech.map((item) => (
            <span key={item} className="ops-chip">
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-auto flex flex-col items-stretch gap-2 min-[380px]:flex-row min-[380px]:items-center">
        <Link
          href={project.gitUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="project-action ops-button-secondary w-full px-3 min-[380px]:flex-1"
        >
          Code
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
          </svg>
        </Link>

        {project.hasDemo && (
          <Link
            href={project.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Server may take about 1 minute to start"
            className="project-action ops-button w-full px-3 min-[380px]:w-auto"
          >
            Demo
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3" />
            </svg>
          </Link>
        )}
      </div>
    </motion.article>
  );
};

const ProjectsSection = () => {
  const [tag, setTag] = useState("All");
  const [showAll, setShowAll] = useState(false);
  const controls = useAnimation();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  useEffect(() => {
    if (inView) {
      controls.start("visible");
    }
  }, [controls, inView]);

  const filteredProjects = projectsData.filter((project) => project.tag.includes(tag));
  const displayedProjects = showAll ? filteredProjects : filteredProjects.slice(0, 6);

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
      id="projects"
      initial={false}
      animate={controls}
      variants={containerVariants}
      className="ops-section"
    >
      <div className="ops-container">
        <motion.div variants={itemVariants} className="mb-10 max-w-3xl">
          <span className="ops-label">Selected projects</span>
          <h2 className="ops-heading mt-4">Projects</h2>
          <p className="mt-4 max-w-2xl text-primary-100">
            Project work that supports my ICT focus: automation utilities,
            data tools, web apps, networking/systems exercises, and selected
            software builds that show how I solve practical technical problems.
          </p>
          <div className="ops-rule mt-5" />
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="mobile-scroll-row mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide sm:mb-8"
        >
          {categories.map((category) => {
            const count = projectsData.filter((project) =>
              category === "All" ? true : project.tag.includes(category)
            ).length;

            return (
              <CategoryButton
                key={category}
                name={category}
                isSelected={tag === category}
                onClick={() => {
                  setTag(category);
                  setShowAll(false);
                }}
                count={count}
              />
            );
          })}
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tag}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {displayedProjects.map((project, index) => (
              <ProjectCard key={project.id} project={project} index={index} isVisible={inView} />
            ))}
          </motion.div>
        </AnimatePresence>

        {filteredProjects.length > 6 && (
          <motion.div variants={itemVariants} className="mt-9 text-center">
            <button onClick={() => setShowAll(!showAll)} className="ops-button-secondary w-full sm:w-auto">
              {showAll ? "Show fewer projects" : `Show all ${filteredProjects.length} projects`}
              <motion.svg
                animate={{ rotate: showAll ? 180 : 0 }}
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </motion.svg>
            </button>
          </motion.div>
        )}

        <motion.div variants={itemVariants} className="mt-10 border-t border-white/10 pt-6">
          <Link
            href="https://github.com/Ciaranengelbrecht"
            target="_blank"
            rel="noopener noreferrer"
            className="ops-button w-full sm:w-auto"
          >
            View GitHub profile
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
            </svg>
          </Link>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default ProjectsSection;
