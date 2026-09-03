import Link from "next/link";
import { contactLinks, resumeHref } from "../data/portfolio";

const ContactSection = () => (
  <section id="contact" className="site-section bg-[#12110f]">
    <div className="site-shell grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-20">
      <div>
        <p className="section-label">Contact</p>
        <h2 className="mt-5 max-w-4xl font-editorial text-[clamp(3.1rem,7vw,6.5rem)] leading-[0.94] tracking-[-0.045em] text-[#f1eee7]">
          Good ICT starts with a clear conversation.
        </h2>
        <p className="section-intro">
          For roles or projects involving support, systems, networks, service delivery, or practical automation, the best way to reach me is by email.
        </p>
        <a href="mailto:ciaran.engelbrecht@outlook.com" className="mt-8 inline-block break-all font-editorial text-xl text-[#d3a479] underline decoration-[#76573e] underline-offset-8 transition-colors hover:text-[#f1eee7] sm:text-3xl">
          ciaran.engelbrecht@outlook.com
        </a>
      </div>

      <div className="border-y border-[#34332f]">
        {contactLinks.slice(1).map((link) => (
          <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-4 border-b border-[#34332f] py-5 last:border-b-0">
            <span>
              <span className="block text-sm font-semibold text-[#d4d0c8]">{link.label}</span>
              <span className="mt-1 block text-xs text-[#85827c]">{link.value}</span>
            </span>
            <span className="text-[#c69262] transition-transform group-hover:translate-x-1" aria-hidden="true">↗</span>
          </a>
        ))}
        <Link href={resumeHref} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-4 border-t border-[#34332f] py-5">
          <span>
            <span className="block text-sm font-semibold text-[#d4d0c8]">Curriculum vitae</span>
            <span className="mt-1 block text-xs text-[#85827c]">View the current PDF</span>
          </span>
          <span className="text-[#c69262] transition-transform group-hover:translate-x-1" aria-hidden="true">↗</span>
        </Link>
      </div>
    </div>
  </section>
);

export default ContactSection;
