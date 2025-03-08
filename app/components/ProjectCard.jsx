"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

const ProjectCard = ({ title, description, imgUrl, gitUrl, liveUrl, tech }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="bg-[#111111] rounded-xl overflow-hidden shadow-lg border border-gray-800 h-full flex flex-col"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}>
      <div className="relative h-56 overflow-hidden">
        {imgUrl ? (
          <>
            <Image
              src={imgUrl}
              alt={title}
              fill
              className={`object-cover transition-transform duration-500 ${
                isHovered ? "scale-110" : "scale-100"
              }`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#111111] to-transparent"></div>
          </>
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary-800/30 to-primary-900/30 flex items-center justify-center">
            <span className="text-3xl font-bold text-primary-300">
              {title.charAt(0)}
            </span>
          </div>
        )}

        {/* Overlay with tech stack badges */}
        <div
          className={`absolute top-2 right-2 flex flex-wrap gap-2 max-w-[75%] justify-end transition-opacity duration-300 ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}>
          {tech &&
            tech.slice(0, 3).map((item, index) => (
              <span
                key={index}
                className="bg-black/50 backdrop-blur-sm text-primary-400 text-xs px-3 py-1 rounded-full">
                {item}
              </span>
            ))}
        </div>
      </div>

      <div className="p-6 flex-grow flex flex-col">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400 mb-4 flex-grow">{description}</p>

        {tech && tech.length > 3 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tech.slice(3).map((item, index) => (
              <span
                key={index}
                className="bg-primary-900/20 text-primary-400 text-xs px-2 py-0.5 rounded-full">
                {item}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-4 mt-auto pt-4 border-t border-gray-800">
          {gitUrl && (
            <Link
              href={gitUrl}
              target="_blank"
              className="flex items-center gap-2 text-gray-400 hover:text-primary-400 transition">
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
              </svg>
              Code
            </Link>
          )}

          {liveUrl && (
            <Link
              href={liveUrl}
              target="_blank"
              className="flex items-center gap-2 text-gray-400 hover:text-primary-400 transition ml-auto">
              Live Demo
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                className="bi bi-arrow-up-right"
                viewBox="0 0 16 16">
                <path
                  fillRule="evenodd"
                  d="M14 2.5a.5.5 0 0 0-.5-.5h-6a.5.5 0 0 0 0 1h4.793L2.146 13.146a.5.5 0 0 0 .708.708L13 3.707V8.5a.5.5 0 0 0 1 0v-6z"
                />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ProjectCard;
