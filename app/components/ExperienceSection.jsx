import { experience } from "../data/portfolio";

const ExperienceSection = () => (
  <section id="experience" className="site-section bg-[#10110f]">
    <div className="site-shell">
      <header className="mb-14 grid gap-7 lg:grid-cols-[0.8fr_1.2fr] lg:items-end lg:gap-20">
        <div>
          <p className="section-label">Experience</p>
          <h2 className="section-title">Support experience with broader technical range.</h2>
        </div>
        <p className="section-intro lg:mb-1">
          Five years across education, managed services, and WA Government—moving from frontline support into systems, networks, cyber security, data, and internal application work.
        </p>
      </header>

      <div className="border-b border-[#34332f]">
        {experience.map((job) => (
          <article key={`${job.role}-${job.organisation}`} className="grid gap-6 border-t border-[#34332f] py-9 lg:grid-cols-[220px_1fr] lg:gap-12 lg:py-11">
            <div>
              <p className="text-sm font-semibold text-[#c69262]">{job.period}</p>
              <p className="mt-2 text-sm text-[#99968f]">{job.organisation}</p>
            </div>
            <div className="max-w-3xl">
              <h3 className="font-editorial text-[1.75rem] leading-tight text-[#f1eee7] sm:text-[2.1rem]">{job.role}</h3>
              <p className="mt-4 text-base leading-7 text-[#c9c5bd]">{job.overview}</p>
              <ul className="mt-6 space-y-3 text-sm leading-7 text-[#aaa79f] sm:text-[0.95rem]">
                {job.achievements.map((achievement) => (
                  <li key={achievement} className="grid grid-cols-[12px_1fr] gap-3">
                    <span className="mt-[0.8rem] h-px w-3 bg-[#806044]" aria-hidden="true" />
                    <span>{achievement}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default ExperienceSection;
