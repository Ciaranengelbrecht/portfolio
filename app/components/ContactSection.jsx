// app/components/ContactSection.jsx
"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";

const ContactSection = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      // Using FormSubmit.co service - replace with your actual email
      const response = await fetch(
        "https://formsubmit.co/ajax/ciaran.engelbrecht@outlook.com",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            subject: formData.subject,
            message: formData.message,
          }),
        }
      );

      const data = await response.json();

      if (data.success === "true" || data.success === true) {
        setEmailSubmitted(true);
        setFormData({ name: "", email: "", subject: "", message: "" });
      } else {
        throw new Error("Form submission failed");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      setError(
        "Failed to send message. Please try again or email me directly."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-20 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-primary-600/10 rounded-full filter blur-3xl"></div>
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-primary-900/10 rounded-full filter blur-3xl"></div>

      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">
            Let&apos;s Connect
          </h2>
          <div className="h-1 w-20 bg-primary-500 mx-auto rounded mb-6"></div>
          <p className="text-[#ADB7BE] max-w-lg mx-auto">
            I'm always interested in hearing about new projects and
            opportunities. Feel free to reach out if you want to connect!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative">
          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-[#111111] p-8 rounded-2xl shadow-xl backdrop-blur-sm border border-gray-800">
            <h3 className="text-2xl font-semibold text-white mb-6">
              Contact Information
            </h3>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary-900/30 rounded-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-6 h-6 text-primary-400">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-medium text-white">Email</h4>
                  <a
                    href="mailto:ciaran.engelbrecht@outlook.com"
                    className="text-[#ADB7BE] hover:text-primary-400">
                    ciaran.engelbrecht@outlook.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary-900/30 rounded-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-6 h-6 text-primary-400">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-medium text-white">Portfolio</h4>
                  <a
                    href="https://github.com/Ciaranengelbrecht"
                    className="text-[#ADB7BE] hover:text-primary-400">
                    github.com/Ciaranengelbrecht
                  </a>
                </div>
              </div>

              <div className="pt-6">
                <h4 className="text-lg font-medium text-white mb-3">
                  Find me on
                </h4>
                <div className="flex gap-4">
                  <Link
                    href="https://www.linkedin.com/in/ciaran-engelbrecht-9a0914243"
                    target="_blank"
                    className="p-3 bg-primary-900/30 rounded-lg hover:bg-primary-800/30 transition-colors">
                    <Image
                      src="/images/linkedin-icon.svg"
                      alt="LinkedIn"
                      width={24}
                      height={24}
                    />
                  </Link>
                  <Link
                    href="https://github.com/Ciaranengelbrecht"
                    target="_blank"
                    className="p-3 bg-primary-900/30 rounded-lg hover:bg-primary-800/30 transition-colors">
                    <Image
                      src="/images/github-icon.svg"
                      alt="GitHub"
                      width={24}
                      height={24}
                    />
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-[#111111] p-8 rounded-2xl shadow-xl backdrop-blur-sm border border-gray-800">
            {emailSubmitted ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-8 h-8 text-green-500">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  Message Sent!
                </h3>
                <p className="text-[#ADB7BE]">
                  Thank you for reaching out. I'll get back to you shortly.
                </p>
                <button
                  onClick={() => setEmailSubmitted(false)}
                  className="mt-6 px-6 py-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium transition-all">
                  Send Another Message
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-semibold text-white mb-6">
                  Send Me a Message
                </h3>

                {/* Show error message if there is one */}
                {error && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-md text-red-400">
                    {error}
                  </div>
                )}

                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="name"
                        className="block text-sm font-medium text-[#ADB7BE] mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full bg-[#181818] border border-[#33353F] rounded-lg py-3 px-4 text-white outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-[#ADB7BE] mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full bg-[#181818] border border-[#33353F] rounded-lg py-3 px-4 text-white outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="subject"
                      className="block text-sm font-medium text-[#ADB7BE] mb-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                      className="w-full bg-[#181818] border border-[#33353F] rounded-lg py-3 px-4 text-white outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="message"
                      className="block text-sm font-medium text-[#ADB7BE] mb-1">
                      Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={4}
                      className="w-full bg-[#181818] border border-[#33353F] rounded-lg py-3 px-4 text-white outline-none focus:ring-2 focus:ring-primary-500"></textarea>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-medium transition-all disabled:opacity-70 flex items-center justify-center">
                    {isSubmitting ? (
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : null}
                    {isSubmitting ? "Sending..." : "Send Message"}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
