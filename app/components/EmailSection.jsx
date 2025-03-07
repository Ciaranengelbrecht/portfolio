"use client";
import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const EmailSection = () => {
  const [emailSubmitted, setEmailSubmitted] = useState(false);

  return (
    <section
      id="contact"
      className="grid md:grid-cols-2 my-12 md:my-12 py-24 gap-4 relative"
    >
      <div className="bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary-900 to-transparent rounded-full h-80 w-80 z-0 blur-lg absolute top-3/4 -left-4 transform -translate-x-1/2 -translate-y-1/2"></div>
      <div className="z-10">
        <h5 className="text-xl font-bold text-white my-2">
          Let&apos;s Connect
        </h5>
        <p className="text-[#ADB7BE] mb-4 max-w-md">
          I&apos;m always looking for new opportunities, check out my projects and profile below.
        </p>
        <div className="socials flex flex-row gap-2">
          <Link href="https://github.com/Ciaranengelbrecht">
            <Image src="/public/github-icon.svg" alt="Github Icon" width={24} height={24} />
          </Link>
          <Link href="https://www.linkedin.com/in/ciaran-engelbrecht-9a0914243/">
            <Image src="/public/linkedin-icon.svg" alt="Linkedin Icon" width={24} height={24} />
          </Link>
        </div>
      </div>
      <div>
        {emailSubmitted ? (
          <p className="text-white">Thank you for subscribing!</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setEmailSubmitted(true);
            }}
          >
            <input
              type="email"
              placeholder="Your email"
              required
              className="p-2 rounded-lg"
            />
            <button type="submit" className="p-2 bg-blue-500 text-white rounded-lg ml-2">
              Subscribe
            </button>
          </form>
        )}
      </div>
    </section>
  );
};

export default EmailSection;
