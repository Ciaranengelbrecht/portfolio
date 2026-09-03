import Link from "next/link";
import { resumeHref } from "../data/portfolio";

const Navbar = () => (
  <header className="site-header">
    <nav className="site-shell header-inner" aria-label="Primary navigation">
      <Link href="#home" className="header-name">Ciaran Engelbrecht</Link>
      <div className="header-links">
        <a href="mailto:ciaran.engelbrecht@outlook.com">Email</a>
        <a href="https://www.linkedin.com/in/ciaran-engelbrecht-9a0914243" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        <Link href={resumeHref} target="_blank" rel="noopener noreferrer">CV</Link>
      </div>
    </nav>
  </header>
);

export default Navbar;
