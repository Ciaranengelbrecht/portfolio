"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { useInView } from "react-intersection-observer";

const contactInfo = [
  {
    label: "Email",
    value: "ciaran.engelbrecht@outlook.com",
    href: "mailto:ciaran.engelbrecht@outlook.com",
    detail: "Best for direct enquiries",
  },
  {
    label: "GitHub",
    value: "github.com/Ciaranengelbrecht",
    href: "https://github.com/Ciaranengelbrecht",
    detail: "Projects and source code",
  },
  {
    label: "LinkedIn",
    value: "Connect with me",
    href: "https://www.linkedin.com/in/ciaran-engelbrecht-9a0914243",
    detail: "Professional profile",
  },
];

const ContactSection = () => {
  const formRef = useRef();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const controls = useAnimation();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  useEffect(() => {
    if (inView) {
      controls.start("visible");
    }
  }, [controls, inView]);

  useEffect(() => {
    if (window.location.search.includes("submitted=true")) {
      setEmailSubmitted(true);
      window.history.replaceState({}, document.title, window.location.pathname + "#contact");
    }
  }, []);

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };

  const resetForm = () => {
    setEmailSubmitted(false);
    setIsSubmitting(false);
    setFormData({
      name: "",
      email: "",
      subject: "",
      message: "",
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      setTimeout(() => {
        formRef.current.submit();
        setEmailSubmitted(true);
      }, 1000);
    } catch (error) {
      console.error("Form submission error:", error);
      setIsSubmitting(false);
    }
  };

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

  const floatingLabelClass = (field) =>
    `absolute left-4 transition-all duration-200 pointer-events-none ${
      focusedField === field || formData[field]
        ? "top-2 text-xs text-accent-300"
        : "top-4 text-primary-400"
    }`;

  return (
    <motion.section
      ref={ref}
      id="contact"
      initial={false}
      animate={controls}
      variants={containerVariants}
      className="ops-section"
    >
      <div className="ops-container">
        <motion.div variants={itemVariants} className="mb-8 max-w-3xl sm:mb-10">
          <span className="ops-label">Contact</span>
          <h2 className="ops-heading mt-4">Get in touch</h2>
          <p className="mt-4 max-w-2xl text-primary-100">
            I&apos;m interested in ICT support, desktop support, systems administration,
            network support, service delivery, and automation-focused opportunities.
            If you have a role or project that fits, feel free to reach out.
          </p>
          <div className="ops-rule mt-5" />
        </motion.div>

        <div className="grid gap-5 sm:gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <motion.div variants={itemVariants} className={`ops-panel p-4 sm:p-6 ${inView ? "motion-soft-rise" : ""}`}>
            <div className="mb-5 border-b border-white/10 pb-4 sm:mb-6">
              <p className="ops-kicker">Contact details</p>
              <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">Contact information</h3>
            </div>

            <div className="space-y-3">
              {contactInfo.map((item, index) => (
                <motion.a
                  key={item.label}
                  href={item.href}
                  target={item.href.startsWith("http") ? "_blank" : undefined}
                  rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  whileHover={{ x: 4 }}
                  className="block rounded-md border border-white/10 bg-white/[0.03] p-3.5 transition-colors duration-200 hover:border-accent-400/35 hover:bg-accent-400/[0.06] sm:p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-primary-400">{item.label}</p>
                      <p className="mt-1 break-all text-sm font-medium text-white">{item.value}</p>
                    </div>
                    <span className="text-accent-300">-&gt;</span>
                  </div>
                  <p className="mt-3 rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-primary-300">
                    {item.detail}
                  </p>
                </motion.a>
              ))}
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className={`ops-panel p-4 sm:p-6 ${inView ? "motion-soft-rise" : ""}`}>
            <AnimatePresence mode="wait">
              {emailSubmitted ? (
                <motion.div
                  key="success"
                  initial={false}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="flex min-h-[300px] flex-col items-center justify-center text-center sm:min-h-[420px]"
                >
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-accent-400/35 bg-accent-400/10 sm:h-16 sm:w-16">
                    <svg className="h-7 w-7 text-accent-300 sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white sm:text-2xl">Message sent successfully</h3>
                  <p className="mt-3 max-w-md text-sm text-primary-100">
                    Thank you for reaching out. I&apos;ll get back to you as soon as possible.
                  </p>
                  <button onClick={resetForm} className="ops-button mt-7">
                    Send another message
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={false}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="mb-5 border-b border-white/10 pb-4 sm:mb-6">
                    <p className="ops-kicker">Message</p>
                    <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">Send me a message</h3>
                    <p className="mt-2 text-sm text-primary-100">
                      Have an ICT opportunity, support role, automation need, or technical project in mind?
                      Send through the details.
                    </p>
                  </div>

                  <form
                    ref={formRef}
                    action="https://formsubmit.co/ciaran.engelbrecht@outlook.com"
                    method="POST"
                    className="space-y-3.5 sm:space-y-4"
                    onSubmit={handleSubmit}
                  >
                    <input type="hidden" name="_subject" value="New message from portfolio website" />
                    <input type="hidden" name="_next" value="https://ciaranengelbrecht.github.io/portfolio/#contact?submitted=true" />
                    <input type="hidden" name="_captcha" value="false" />
                    <input type="hidden" name="_template" value="table" />

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="relative">
                        <label htmlFor="name" className={floatingLabelClass("name")}>
                          Your Name
                        </label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          onFocus={() => setFocusedField("name")}
                          onBlur={() => setFocusedField(null)}
                          required
                          className="ops-input"
                        />
                      </div>

                      <div className="relative">
                        <label htmlFor="email" className={floatingLabelClass("email")}>
                          Email Address
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          onFocus={() => setFocusedField("email")}
                          onBlur={() => setFocusedField(null)}
                          required
                          className="ops-input"
                        />
                      </div>
                    </div>

                    <div className="relative">
                      <label htmlFor="subject" className={floatingLabelClass("subject")}>
                        Subject
                      </label>
                      <input
                        type="text"
                        id="subject"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        onFocus={() => setFocusedField("subject")}
                        onBlur={() => setFocusedField(null)}
                        required
                        className="ops-input"
                      />
                    </div>

                    <div className="relative">
                      <label htmlFor="message" className={floatingLabelClass("message")}>
                        Your Message
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        onFocus={() => setFocusedField("message")}
                        onBlur={() => setFocusedField(null)}
                        required
                        rows={5}
                        className="ops-input resize-none"
                      />
                    </div>

                    <motion.button
                      type="submit"
                      disabled={isSubmitting}
                      whileHover={{ scale: isSubmitting ? 1 : 1.01 }}
                      whileTap={{ scale: isSubmitting ? 1 : 0.99 }}
                      className="ops-button w-full disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Sending...
                        </>
                      ) : (
                        <>
                          Send message
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                          </svg>
                        </>
                      )}
                    </motion.button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
};

export default ContactSection;
