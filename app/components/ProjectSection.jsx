// app/components/ProjectsSection.jsx
"use client";
import React, { useState, useEffect } from "react";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import { useInView } from "react-intersection-observer";
import Link from "next/link";

// Project icons by category
const categoryIcons = {
  All: "🎯",
  Web: "🌐",
  AI: "🤖",
  Security: "🔒",
  Systems: "⚙️",
  Algorithms: "📊",
  Graphics: "🎨",
  Utility: "🔧",
};

const projectsData = [
  {
    id: 1,
    title: "Macro Scanner",
    description:
      "Cross-platform security tooling for triaging macro-enabled Office documents with heuristic analysis, Defender integration, and browser-based batch processing.",
    tag: ["All", "Security"],
    gitUrl: "https://github.com/Ciaranengelbrecht/macro-scanner",
    previewUrl: "https://github.com/Ciaranengelbrecht/macro-scanner",
    tech: ["JavaScript", "Python", "PowerShell", "Security"],
    featured: true,
  },
  {
    id: 2,
    title: "LiftLog - Gym Progress Tracker",
    description:
      "Fast, offline-first PWA for tracking lifting sessions and body measurements with heuristic recovery modeling and guided program setup.",
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
      "Full-stack task management platform with real-time collaboration, user authentication, and intuitive UI for team productivity.",
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
      "Computer vision system for detecting and extracting tables from documents, converting them to structured data formats.",
    tag: ["All", "AI"],
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
      "End-to-end optical character recognition system for extracting and processing text from scanned documents.",
    tag: ["All", "AI"],
    gitUrl: "https://github.com/Ciaranengelbrecht/CITS3200-OCR-Project",
    previewUrl: "https://github.com/Ciaranengelbrecht/CITS3200-OCR-Project",
    tech: ["Python", "PyTorch", "Image Processing"],
  },
  {
    id: 8,
    title: "PDF Subject Splitter",
    description:
      "Automated tool for splitting large PDF documents by subject markers, streamlining document organization workflows.",
    tag: ["All", "Utility"],
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
      "Custom networking server implementing TCP/IP protocols and concurrent connection handling.",
    tag: ["All", "Systems"],
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

// Category filter button
const CategoryButton = ({ name, isSelected, onClick, count }) => (
  <motion.button
    onClick={onClick}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    className={`
      flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm transition-all duration-300 whitespace-nowrap flex-shrink-0 active:scale-95
      ${isSelected 
        ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-glow-sm" 
        : "glass border border-white/10 text-slate-400 hover:text-white hover:border-primary-500/50"
      }
    `}
  >
    <span>{categoryIcons[name]}</span>
    <span>{name}</span>
    {count !== undefined && (
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20' : 'bg-white/10'}`}>
        {count}
      </span>
    )}
  </motion.button>
);

// Enhanced Project Card
const ProjectCard = ({ project, index, isVisible }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        group relative glass-card overflow-hidden h-full
        ${project.featured ? 'ring-1 ring-primary-500/30' : ''}
      `}
    >
      {/* Featured badge */}
      {project.featured && (
        <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-20">
          <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded-full bg-gradient-to-r from-primary-500 to-accent-500 text-white">
            Featured
          </span>
        </div>
      )}

      {/* Gradient top border */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 via-accent-500 to-primary-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Hover gradient overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-accent-500/5 pointer-events-none"
      />

      <div className="relative z-10 p-4 sm:p-5 md:p-6 flex flex-col h-full">
        {/* Category icon */}
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <motion.div
            animate={{ rotate: isHovered ? 10 : 0 }}
            className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 text-xl sm:text-2xl"
          >
            {categoryIcons[project.tag[1]] || "📁"}
          </motion.div>
        </div>

        {/* Title */}
        <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5 sm:mb-2 group-hover:text-primary-400 transition-colors">
          {project.title}
        </h3>

        {/* Description */}
        <p className="text-slate-400 text-xs sm:text-sm mb-3 sm:mb-4 flex-grow leading-relaxed">
          {project.description}
        </p>

        {/* Tech stack */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4 sm:mb-6">
          {project.tech.map((item, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              className="px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded-full glass border border-primary-500/20 text-primary-400 hover:border-primary-500/50 transition-colors"
            >
              {item}
            </motion.span>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 sm:gap-3 mt-auto">
          <Link
            href={project.gitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group/btn flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl glass border border-white/10 text-slate-300 hover:text-white hover:border-primary-500/50 transition-all duration-300 active:scale-95"
          >
            <svg className="w-3.5 sm:w-4 h-3.5 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"/>
            </svg>
            <span className="text-sm font-medium">Code</span>
            <svg className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>

          {project.hasDemo && (
            <div className="relative">
              <Link
                href={project.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="group/btn flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-400 hover:to-primary-500 shadow-glow-sm hover:shadow-glow transition-all duration-300"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                <span className="text-sm font-medium">Demo</span>
              </Link>
              
              {/* Tooltip */}
              <AnimatePresence>
                {showTooltip && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-surface-900 border border-white/10 rounded-lg whitespace-nowrap z-20 shadow-xl"
                  >
                    Server may take ~1 min to start
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-900" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Corner decoration */}
      <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-primary-500/10 to-transparent rounded-tl-[100px] pointer-events-none" />
    </motion.div>
  );
};

const ProjectsSection = () => {
  const [tag, setTag] = useState("All");
  const [showAll, setShowAll] = useState(false);
  const controls = useAnimation();
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  useEffect(() => {
    if (inView) {
      controls.start("visible");
    }
  }, [controls, inView]);

  const filteredProjects = projectsData.filter((project) =>
    project.tag.includes(tag)
  );

  // Show only first 6 projects unless "show all" is clicked
  const displayedProjects = showAll ? filteredProjects : filteredProjects.slice(0, 6);

  const categories = ["All", "Web", "AI", "Security", "Systems", "Algorithms", "Graphics"];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] },
    },
  };

  return (
    <motion.section
      ref={ref}
      id="projects"
      initial="hidden"
      animate={controls}
      variants={containerVariants}
      className="py-12 sm:py-16 md:py-20 relative overflow-hidden"
    >
      {/* Background decorations */}
      <div className="absolute top-1/3 -right-32 w-64 sm:w-96 h-64 sm:h-96 bg-accent-500/10 rounded-full filter blur-3xl" />
      <div className="absolute bottom-1/3 -left-32 w-64 sm:w-96 h-64 sm:h-96 bg-primary-500/10 rounded-full filter blur-3xl" />

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        {/* Section Header */}
        <motion.div variants={itemVariants} className="text-center mb-10 sm:mb-12 md:mb-16">
          <span className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass border border-warm-500/40 text-warm-400 text-xs sm:text-sm font-medium mb-3 sm:mb-4 shadow-lg">
            <span className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-warm-400 animate-pulse" />
            Portfolio Showcase
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
            Featured <span className="text-transparent bg-clip-text bg-gradient-to-r from-warm-400 via-primary-100 to-white">Projects</span>
          </h2>
          <div className="h-0.5 sm:h-1 w-16 sm:w-24 bg-gradient-to-r from-warm-500 to-warm-400 mx-auto rounded-full mb-4 sm:mb-6 shadow-lg" />
          <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base md:text-lg px-2 sm:px-0">
            A collection of projects showcasing my skills in web development, 
            artificial intelligence, systems programming, and more.
          </p>
        </motion.div>

        {/* Category Filter */}
        <motion.div 
          variants={itemVariants}
          className="flex overflow-x-auto pb-2 sm:pb-0 sm:flex-wrap sm:justify-center gap-2 sm:gap-3 mb-8 sm:mb-10 md:mb-12 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {categories.map((category) => {
            const count = projectsData.filter(p => 
              category === "All" ? true : p.tag.includes(category)
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

        {/* Projects Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tag}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6"
          >
            {displayedProjects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={index}
                isVisible={inView}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Show More / Show Less Button */}
        {filteredProjects.length > 6 && (
          <motion.div 
            variants={itemVariants}
            className="text-center mt-8 sm:mt-10 md:mt-12"
          >
            <motion.button
              onClick={() => setShowAll(!showAll)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl glass border border-white/10 text-slate-300 hover:text-white hover:border-primary-500/50 transition-all duration-300 text-sm sm:text-base active:scale-95"
            >
              <span>{showAll ? "Show Less" : `Show All (${filteredProjects.length})`}</span>
              <motion.svg
                animate={{ rotate: showAll ? 180 : 0 }}
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </motion.svg>
            </motion.button>
          </motion.div>
        )}

        {/* GitHub CTA */}
        <motion.div 
          variants={itemVariants}
          className="text-center mt-10 sm:mt-12 md:mt-16"
        >
          <p className="text-slate-400 mb-3 sm:mb-4 text-sm sm:text-base">Want to see more of my work?</p>
          <Link
            href="https://github.com/Ciaranengelbrecht"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 btn-primary"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"/>
            </svg>
            View GitHub Profile
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default ProjectsSection;
