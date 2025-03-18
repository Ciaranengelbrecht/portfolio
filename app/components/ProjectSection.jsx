// app/components/ProjectsSection.jsx
"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const projectsData = [
  {
    id: 1,
    title: "CITS3005 Ontology Project",
    description:
      "Ontology-based project focusing on knowledge representation and semantic web technologies.",
    image: "/images/projects/project1.jpg", // Use a placeholder image
    tag: ["All", "Web"],
    gitUrl: "https://github.com/Ciaranengelbrecht/CITS3005-Ontology-Project",
    previewUrl:
      "https://github.com/Ciaranengelbrecht/CITS3005-Ontology-Project",
    tech: ["CSS", "Semantic Web", "Ontology"],
  },
  {
    id: 2,
    title: "CITS3200 OCR Project",
    description:
      "Optical Character Recognition project for extracting and processing text from documents.",
    image: "/images/projects/project2.jpg",
    tag: ["All", "AI"],
    gitUrl: "https://github.com/Ciaranengelbrecht/CITS3200-OCR-Project",
    previewUrl: "https://github.com/Ciaranengelbrecht/CITS3200-OCR-Project",
    tech: ["Python", "OCR", "Image Processing"],
  },
  {
    id: 3,
    title: "Subject Selection Splitter",
    description:
      "PDF splitter for subject selections - automates the process of separating PDF documents by subject.",
    image: "/images/projects/project3.jpg", // Add this image
    tag: ["All", "Utility"],
    gitUrl: "https://github.com/Ciaranengelbrecht/subject-selection-splitter",
    previewUrl:
      "https://github.com/Ciaranengelbrecht/subject-selection-splitter",
    tech: ["Python", "PDF Processing"],
  },
  {
    id: 4,
    title: "TaskHub Web Project",
    description:
      "Web application for task management and collaboration built using modern web technologies.",
    tag: ["All", "Web"],
    gitUrl: "https://github.com/Ciaranengelbrecht/CITS3403-TaskHub-Web-Project",
    previewUrl: "https://taskhub.ciaranengelbrecht.com",
    tech: ["JavaScript", "Node.js", "Express", "MongoDB"],
    hasDemo: true, // Add this field
  },
  {
    id: 5,
    title: "Systems Programming",
    description:
      "Collection of systems programming projects and lab work focusing on low-level programming concepts.",
    image: "/images/projects/project5.jpg", // Add this image
    tag: ["All", "Systems"],
    gitUrl: "https://github.com/Ciaranengelbrecht/Systems-Programming",
    previewUrl: "https://github.com/Ciaranengelbrecht/Systems-Programming",
    tech: ["C", "Systems Programming"],
  },
  {
    id: 6,
    title: "Data Structures and Algorithms",
    description:
      "Implementation of various data structures and algorithms with practical applications.",
    image: "/images/projects/project6.jpg", // Add this image
    tag: ["All", "Algorithms"],
    gitUrl:
      "https://github.com/Ciaranengelbrecht/Data-Structures-and-Algorithms",
    previewUrl:
      "https://github.com/Ciaranengelbrecht/Data-Structures-and-Algorithms",
    tech: ["Java", "Data Structures", "Algorithms"],
  },
  {
    id: 7,
    title: "Algorithms, Agents, and AI",
    description:
      "Projects related to algorithmic problem-solving, agent-based systems, and artificial intelligence.",
    image: "/images/projects/project7.jpg", // Add this image
    tag: ["All", "AI"],
    gitUrl: "https://github.com/Ciaranengelbrecht/Algorithms-Agents-and-AI",
    previewUrl: "https://github.com/Ciaranengelbrecht/Algorithms-Agents-and-AI",
    tech: ["Python", "AI", "Machine Learning"],
  },
  {
    id: 8,
    title: "Networking Server Project",
    description:
      "Implementation of networking protocols and server-side applications.",
    image: "/images/projects/project8.jpg", // Add this image
    tag: ["All", "Systems"],
    gitUrl: "https://github.com/Ciaranengelbrecht/Networking-Server-Project",
    previewUrl:
      "https://github.com/Ciaranengelbrecht/Networking-Server-Project",
    tech: ["C", "Networking", "Server Development"],
  },
  {
    id: 9,
    title: "OCR Table Detection & PDF Conversion",
    description:
      "Professional Computing project for detecting tables in documents and converting them to structured PDFs.",
    image: "/images/projects/project9.jpg", // Add this image
    tag: ["All", "AI"],
    gitUrl:
      "https://github.com/Ciaranengelbrecht/OCR-Table-Detection-and-PDF-conversion-Project",
    previewUrl:
      "https://github.com/Ciaranengelbrecht/OCR-Table-Detection-and-PDF-conversion-Project",
    tech: ["Python", "OCR", "PDF Processing"],
  },
  {
    id: 10,
    title: "Car Park System",
    description:
      "Automated system for managing car parks, tracking occupancy and facilitating reservations.",
    image: "/images/projects/project10.jpg", // Add this image
    tag: ["All", "Web"],
    gitUrl: "https://github.com/Ciaranengelbrecht/Car-Park-System",
    previewUrl: "https://github.com/Ciaranengelbrecht/Car-Park-System",
    tech: ["Python", "Database", "System Design"],
  },
  {
    id: 11,
    title: "Graphics and Animation Project",
    description:
      "3D graphics and animation project exploring rendering techniques and visual effects.",
    image: "/images/projects/project11.jpg", // Add this image
    tag: ["All", "Graphics"],
    gitUrl:
      "https://github.com/Ciaranengelbrecht/CITS3003_Project_Gaphics-and-Animation",
    previewUrl:
      "https://github.com/Ciaranengelbrecht/CITS3003_Project_Gaphics-and-Animation",
    tech: ["C++", "Graphics", "Animation"],
  },
  {
    id: 12,
    title: "Super Mario Bros ML Speedrun",
    description:
      "Machine learning project that trains an AI to speedrun Super Mario Bros.",
    image: "/images/projects/project12.jpg", // Add this image
    tag: ["All", "AI"],
    gitUrl:
      "https://github.com/Ciaranengelbrecht/Super-Mario-Bros-ML-AI-Speedrun",
    previewUrl:
      "https://github.com/Ciaranengelbrecht/Super-Mario-Bros-ML-AI-Speedrun",
    tech: ["Python", "Machine Learning", "Game AI"],
  },
];

// Project filter categories
const ProjectTag = ({ name, onClick, isSelected }) => {
  const buttonClasses = isSelected
    ? "bg-primary-500 text-white"
    : "bg-slate-800 text-[#ADB7BE] hover:text-white";
  return (
    <button
      className={`${buttonClasses} rounded-full px-6 py-3 text-lg cursor-pointer`}
      onClick={() => onClick(name)}>
      {name}
    </button>
  );
};

const ProjectCard = ({
  title,
  description,
  gitUrl,
  previewUrl,
  tech,
  hasDemo = false,
}) => {
  // Add state to track if tooltip is shown
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-[#181818] rounded-xl overflow-hidden shadow-xl h-full">
      <div className="p-6 flex flex-col h-full">
        <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-[#ADB7BE] mb-4">{description}</p>
        <div className="flex flex-wrap gap-2 mb-6">
          {tech.map((item, index) => (
            <span
              key={index}
              className="bg-primary-700/20 text-primary-400 text-xs px-3 py-1 rounded-full">
              {item}
            </span>
          ))}
        </div>
        <div className="flex justify-between items-center mt-auto">
          <Link
            href={gitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-[#121212] hover:bg-slate-800 text-white rounded-lg flex items-center gap-2">
            Code <span>→</span>
          </Link>

          {hasDemo && (
            <div className="relative group">
              <Link
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center gap-2"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={() => {
                  alert(
                    "Demo server may take up to 1 minute to spin up if inactive."
                  );
                }}>
                Demo <span>→</span>
              </Link>

              {/* Tooltip positioned above button */}
              {showTooltip && (
                <div className="absolute left-1/2 bottom-full transform -translate-x-1/2 mb-2 p-2 bg-black/80 text-xs text-white rounded-md w-48 z-10 shadow-lg">
                  Please allow up to a minute for the server to start if it has
                  been inactive.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Small note below for demo links */}
        {hasDemo && (
          <p className="text-gray-400 text-xs mt-2 italic text-center">
            Note: Server may take up to 1 minute to start if inactive
          </p>
        )}
      </div>
    </motion.div>
  );
};

const ProjectsSection = () => {
  const [tag, setTag] = useState("All");

  const filteredProjects = projectsData.filter((project) =>
    project.tag.includes(tag)
  );

  const handleTagChange = (newTag) => {
    setTag(newTag);
  };

  return (
    <section id="projects" className="py-20 text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}>
        <h2 className="text-4xl font-bold text-center mb-2">My Projects</h2>
        <p className="text-[#ADB7BE] text-lg text-center mb-10">
          Explore my recent work and technical capabilities
        </p>
        <div className="flex flex-row justify-center items-center gap-2 md:gap-4 py-6 flex-wrap">
          <ProjectTag
            onClick={handleTagChange}
            name="All"
            isSelected={tag === "All"}
          />
          <ProjectTag
            onClick={handleTagChange}
            name="Web"
            isSelected={tag === "Web"}
          />
          <ProjectTag
            onClick={handleTagChange}
            name="AI"
            isSelected={tag === "AI"}
          />
          <ProjectTag
            onClick={handleTagChange}
            name="Systems"
            isSelected={tag === "Systems"}
          />
          <ProjectTag
            onClick={handleTagChange}
            name="Algorithms"
            isSelected={tag === "Algorithms"}
          />
          <ProjectTag
            onClick={handleTagChange}
            name="Graphics"
            isSelected={tag === "Graphics"}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              title={project.title}
              description={project.description}
              gitUrl={project.gitUrl}
              previewUrl={project.previewUrl}
              tech={project.tech}
              hasDemo={project.hasDemo || false} // Add this prop
            />
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default ProjectsSection;
