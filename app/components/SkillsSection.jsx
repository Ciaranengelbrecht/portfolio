import { capabilityGroups } from "../data/portfolio";

const SkillsSection = () => (
  <section id="skills" className="site-section bg-[#161714]">
    <div className="site-shell">
      <header className="max-w-3xl">
        <p className="section-label">Capabilities</p>
        <h2 className="section-title">A toolkit built around real environments.</h2>
        <p className="section-intro">
          Support and infrastructure are the foundation. Security, data, scripting, and development extend what I can diagnose, improve, and automate.
        </p>
      </header>

      <div className="mt-14 grid border-b border-[#3a3934] md:grid-cols-2">
        {capabilityGroups.map((group, index) => (
          <article
            key={group.title}
            className={`border-t border-[#3a3934] py-8 md:px-8 ${index % 2 === 0 ? "md:border-r md:pl-0" : "md:pr-0"} ${index === capabilityGroups.length - 1 ? "md:col-span-2 md:grid md:grid-cols-2 md:gap-8 md:border-r-0" : ""}`}
          >
            <div>
              <h3 className="font-editorial text-2xl text-[#eeeae2] sm:text-[1.7rem]">{group.title}</h3>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#b5b1a9]">{group.description}</p>
            </div>
            <p className="mt-6 border-l border-[#76573e] pl-4 text-xs leading-6 text-[#8f8c85] md:mt-0">
              {group.tools}
            </p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default SkillsSection;
