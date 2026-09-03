import { archivedProjects, featuredProjects } from "../data/portfolio";

const ProjectLinks = ({ project }) => (
  <div className="mt-7 flex flex-wrap gap-5">
    <a href={project.repository} target="_blank" rel="noopener noreferrer" className="arrow-link">
      Repository <span aria-hidden="true">↗</span>
    </a>
    {project.demo && (
      <a href={project.demo} target="_blank" rel="noopener noreferrer" className="arrow-link">
        Live project <span aria-hidden="true">↗</span>
      </a>
    )}
  </div>
);

const ProjectsSection = () => (
  <section id="projects" className="site-section bg-[#10110f]">
    <div className="site-shell">
      <header className="mb-14 grid gap-7 lg:grid-cols-[0.8fr_1.2fr] lg:items-end lg:gap-20">
        <div>
          <p className="section-label">Selected projects</p>
          <h2 className="section-title">Code used to solve practical problems.</h2>
        </div>
        <p className="section-intro lg:mb-1">
          A focused selection spanning automation, security, networking, and full-stack development. The emphasis is on useful outcomes and considered implementation.
        </p>
      </header>

      <div className="grid border-b border-[#34332f] lg:grid-cols-2">
        {featuredProjects.map((project, index) => (
          <article
            key={project.title}
            className={`project-item flex min-h-[360px] flex-col border-t border-[#34332f] py-9 lg:px-9 ${index % 2 === 0 ? "lg:border-r lg:pl-0" : "lg:pr-0"}`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#c69262]">{project.category}</p>
            <h3 className="mt-5 font-editorial text-3xl leading-tight text-[#f1eee7] sm:text-[2.2rem]">{project.title}</h3>
            <p className="mt-5 max-w-xl text-sm leading-7 text-[#b5b1a9] sm:text-[0.95rem]">{project.description}</p>
            <p className="mt-auto pt-8 text-xs leading-6 text-[#85827c]">{project.technologies}</p>
            <ProjectLinks project={project} />
          </article>
        ))}
      </div>

      <details className="archive mt-14 border-y border-[#34332f]">
        <summary className="flex cursor-pointer items-center justify-between gap-5 py-6 text-left">
          <span>
            <span className="block font-editorial text-2xl text-[#eeeae2]">Project archive</span>
            <span className="mt-1 block text-sm text-[#8f8c85]">Ten additional academic and personal builds</span>
          </span>
          <span className="archive-marker relative h-9 w-9 flex-none border border-[#4b4943] text-[#c69262]" aria-hidden="true" />
        </summary>
        <div className="border-t border-[#34332f] pb-3">
          {archivedProjects.map((project) => (
            <a
              key={project.title}
              href={project.repository}
              target="_blank"
              rel="noopener noreferrer"
              className="group grid gap-2 border-b border-[#292925] py-5 transition-colors last:border-b-0 hover:text-[#d3a479] sm:grid-cols-[1fr_220px_auto] sm:items-center sm:gap-6"
            >
              <span className="font-medium text-[#d4d0c8] transition-colors group-hover:text-[#f1eee7]">{project.title}</span>
              <span className="text-sm text-[#85827c]">{project.category}</span>
              <span className="text-sm text-[#c69262]">View ↗</span>
            </a>
          ))}
        </div>
      </details>
    </div>
  </section>
);

export default ProjectsSection;
