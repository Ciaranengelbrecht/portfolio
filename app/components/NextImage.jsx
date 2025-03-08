"use client";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function NextImage({ src, ...props }) {
  // Get the current path to detect if we're on GitHub Pages
  const pathname = usePathname();
  const isGitHubPages = pathname.startsWith("/portfolio");

  // Adjust the src path based on environment
  const adjustedSrc = src.startsWith("/")
    ? isGitHubPages
      ? `/portfolio${src}`
      : src
    : src;

  return <Image src={adjustedSrc} {...props} />;
}
