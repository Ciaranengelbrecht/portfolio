// app/components/ProjectsSection.jsx
"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const projectsData = [
  {
    id: 1,
    title: "Project 1",
    description:
      "This is a description of project 1. It includes details about technologies used and what problems it solves.",
    image: "/images/projects/project1.jpg",
    tag: ["All", "Web"],
    gitUrl: "https://github.com/Ciaranengelbrecht",
    previewUrl: "/",
    tech: ["React", "Tailwind", "JavaScript"],
  },
  {
    id: 2,
    title: "Project 2",
    description:
      "This is a description of project 2. It includes details about technologies used and what problems it solves.",
    image: "/images/projects/project2.jpg",
    tag: ["All", "Mobile"],
    gitUrl: "https://github.com/Ciaranengelbrecht",
    previewUrl: "/",
    tech: ["Python", "TensorFlow", "Pandas"],
  },
  // Add more projects as needed
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
  imgUrl,
  title,
  description,
  gitUrl,
  previewUrl,
  tech,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-[#181818] rounded-xl overflow-hidden shadow-xl h-full">
      <div className="relative h-52 md:h-72">
        {imgUrl ? (
          <Image src={imgUrl} alt={title} className="object-cover" fill />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-primary-800 to-secondary flex items-center justify-center">
            <p className="text-white text-xl">{title}</p>
          </div>
        )}
      </div>
      <div className="p-6">
        <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-[#ADB7BE] mb-4">{description}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {tech.map((item, index) => (
            <span
              key={index}
              className="bg-primary-700/20 text-primary-400 text-xs px-3 py-1 rounded-full">
              {item}
            </span>
          ))}
        </div>
        <div className="flex justify-between">
          <Link
            href={gitUrl}
            target="_blank"
            className="px-4 py-2 bg-[#121212] hover:bg-slate-800 text-white rounded-lg flex items-center gap-2">
            Code <span>→</span>
          </Link>
          <Link
            href={previewUrl}
            target="_blank"
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center gap-2">
            Demo <span>→</span>
          </Link>
        </div>
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
        <div className="flex flex-row justify-center items-center gap-2 md:gap-4 py-6">
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
            name="Mobile"
            isSelected={tag === "Mobile"}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              title={project.title}
              description={project.description}
              imgUrl={project.image}
              gitUrl={project.gitUrl}
              previewUrl={project.previewUrl}
              tech={project.tech}
            />
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default ProjectsSection;
