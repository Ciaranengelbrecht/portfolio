"use client";
import React from "react";
import { TypeAnimation } from "react-type-animation";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";

const HeroSection = () => {
  return (
    <section className="lg:py-16">
      <div className="grid grid-cols-1 sm:grid-cols-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="col-span-8 place-self-center text-center sm:text-left justify-self-start"
        >
          <h1 className="text-white mb-4 text-4xl sm:text-5xl lg:text-8xl lg:leading-normal font-extrabold">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#868F96] to-[#596164]">
              Welcome. {"I'm "}
            </span>
            <br></br>
            <TypeAnimation
              sequence={[
                "Ciaran",
                1000,
                "a developer",
                1000,
                "an innovator",
                1000,
                "a software engineer.",
                1000,
              ]}
              wrapper="span"
              speed={50}
              repeat={Infinity}
            />
          </h1>
          <p className="text-[#ADB7BE] text-base sm:text-lg mb-6 lg:text-xl">
             This is my portfolio.
          </p>
          <div>
            <Link
              href="mailto:ciaran.engelbrecht@outlook.com"
              className="px-6 inline-block py-3 w-full sm:w-fit rounded-full mr-4 bg-gradient-to-br from-[#868F96] to-[#596164] hover:bg-slate-200 text-white"
            >
              Contact Me
            </Link>
            <Link
              href="https://s3.ap-southeast-2.amazonaws.com/ciaranengelbrecht.com/Resume+Ciaran+Engelbrecht+for+website.pdf"
              className="px-1 inline-block py-1 w-full sm:w-fit rounded-full bg-gradient-to-br from-[#868F96] to-[#596164] hover:bg-slate-800 text-white mt-3"
            >
              <span className="block bg-[#121212] hover:bg-slate-800 rounded-full px-5 py-2">
                Download Resume
              </span>
            </Link>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="col-span-4 place-self-center mt-4 lg:mt-0"
        >
          <div className="rounded-full bg-[#181818] w-[250px] h-[250px] lg:w-[400px] lg:h-[400px] relative">
            <Image
              src="/images/portrait.png"
              alt="hero image"
              className="absolute transform -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2"
              width={390}
              height={390}
              priority  // Ensures the image is loaded as soon as possible
              placeholder="blur"  // Adds a blur effect while the image is loading
              blurDataURL="/images/portrait-blur.png"  // Use a small base64-encoded image as a placeholder
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
