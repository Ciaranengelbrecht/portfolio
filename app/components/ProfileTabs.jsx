"use client";

import { useEffect, useState } from "react";
import {
  capabilityGroups,
  certifications,
  clearances,
  education,
  experience,
  featuredProjects,
} from "../data/portfolio";

const tabs = [
  { id: "experience", label: "Experience" },
  { id: "skills", label: "Skills" },
  { id: "education", label: "Education" },
  { id: "projects", label: "Projects" },
];

const validTabs = new Set(tabs.map((tab) => tab.id));

const ExternalLink = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="inline-link">
    {children} <span aria-hidden="true">↗</span>
  </a>
);

const ExperiencePanel = () => {
  const [selectedRole, setSelectedRole] = useState(0);
  const job = experience[selectedRole];

  return (
    <div className="experience-layout">
      <div className="role-list" aria-label="Employment history">
        {experience.map((item, index) => (
          <button
            key={`${item.organisation}-${item.period}`}
            type="button"
            className="role-button"
            aria-pressed={selectedRole === index}
            onClick={() => setSelectedRole(index)}
          >
            <span>{item.organisation}</span>
            <span className="meta-text">{item.period}</span>
          </button>
        ))}
      </div>

      <article className="role-detail" key={`${job.organisation}-${selectedRole}`}>
        <p className="meta-text">{job.period}</p>
        <h3>{job.role}</h3>
        <p className="role-organisation">{job.organisation}</p>
        <p className="role-overview">{job.overview}</p>
        <ul className="plain-list">
          {job.achievements.map((achievement) => (
            <li key={achievement}>{achievement}</li>
          ))}
        </ul>
      </article>
    </div>
  );
};

const SkillsPanel = () => (
  <div className="data-list">
    {capabilityGroups.map((group) => (
      <article key={group.title} className="data-row">
        <h3>{group.title}</h3>
        <p>{group.tools}</p>
      </article>
    ))}
  </div>
);

const EducationPanel = () => (
  <div className="education-layout">
    <section aria-labelledby="qualifications-title">
      <h3 id="qualifications-title" className="panel-subtitle">Qualifications</h3>
      <div className="data-list">
        {education.map((item) => (
          <article key={item.qualification} className="education-row">
            <p className="meta-text">{item.year}</p>
            <h4>{item.qualification}</h4>
            <p>{item.institution}</p>
          </article>
        ))}
      </div>
    </section>

    <div className="credential-columns">
      <section aria-labelledby="certifications-title">
        <h3 id="certifications-title" className="panel-subtitle">Certifications</h3>
        <ul className="simple-list">
          {certifications.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="clearances-title">
        <h3 id="clearances-title" className="panel-subtitle">Clearances</h3>
        <ul className="simple-list">
          {clearances.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  </div>
);

const ProjectsPanel = () => (
  <div>
    <div className="data-list">
      {featuredProjects.map((project) => (
        <article key={project.title} className="project-row">
          <div>
            <h3>{project.title}</h3>
            <p>{project.description}</p>
          </div>
          <div className="project-links">
            <ExternalLink href={project.repository}>Code</ExternalLink>
            {project.demo && <ExternalLink href={project.demo}>Live</ExternalLink>}
          </div>
        </article>
      ))}
    </div>
    <ExternalLink href="https://github.com/Ciaranengelbrecht">More projects on GitHub</ExternalLink>
  </div>
);

const panels = {
  experience: <ExperiencePanel />,
  skills: <SkillsPanel />,
  education: <EducationPanel />,
  projects: <ProjectsPanel />,
};

const ProfileTabs = () => {
  const [activeTab, setActiveTab] = useState("experience");

  useEffect(() => {
    const selectFromHash = () => {
      const requested = window.location.hash.slice(1);
      setActiveTab(validTabs.has(requested) ? requested : "experience");
    };

    selectFromHash();
    window.addEventListener("hashchange", selectFromHash);
    window.addEventListener("popstate", selectFromHash);
    return () => {
      window.removeEventListener("hashchange", selectFromHash);
      window.removeEventListener("popstate", selectFromHash);
    };
  }, []);

  const selectTab = (id, updateHistory = true) => {
    setActiveTab(id);
    if (updateHistory && window.location.hash !== `#${id}`) {
      window.history.pushState(null, "", `#${id}`);
    }
  };

  const handleKeyDown = (event, index) => {
    let nextIndex = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    const nextTab = tabs[nextIndex].id;
    selectTab(nextTab);
    document.getElementById(`tab-${nextTab}`)?.focus();
  };

  return (
    <section className="profile-section" aria-label="Professional profile sections">
      {tabs.map((tab) => (
        <span key={tab.id} id={tab.id} className="profile-anchor" aria-hidden="true" />
      ))}
      <div className="site-shell">
        <div className="tab-list" role="tablist" aria-label="Portfolio sections">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {tabs.map((tab) => (
          <div
            key={tab.id}
            id={`panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab.id}`}
            className="tab-panel"
            hidden={activeTab !== tab.id}
          >
            <h2 className="sr-only">{tab.label}</h2>
            {panels[tab.id]}
          </div>
        ))}
      </div>
    </section>
  );
};

export default ProfileTabs;
