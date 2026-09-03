import Link from "next/link";

const Footer = () => (
  <footer className="bg-[#10110f]">
    <div className="site-shell flex flex-col gap-5 py-8 text-xs text-[#7f7c76] sm:flex-row sm:items-center sm:justify-between">
      <p>© {new Date().getFullYear()} Ciaran Engelbrecht</p>
      <p>ICT support · systems · networks · practical automation</p>
      <Link href="#home" className="text-link w-fit">Back to top</Link>
    </div>
  </footer>
);

export default Footer;
