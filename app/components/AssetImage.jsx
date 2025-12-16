"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";

const AssetImage = ({ src, ...props }) => {
  const [adjustedSrc, setAdjustedSrc] = useState(src);

  useEffect(() => {
    // Check if we're on GitHub Pages or custom domain
    const isGitHubPages =
      window.location.hostname.includes("github.io") &&
      window.location.pathname.startsWith("/portfolio");

    if (isGitHubPages && !src.startsWith("/portfolio/")) {
      // On GitHub Pages but path doesn't have /portfolio/ prefix
      setAdjustedSrc(`/portfolio${src.startsWith("/") ? src : `/${src}`}`);
    } else if (!isGitHubPages && src.startsWith("/portfolio/")) {
      // On custom domain but path has /portfolio/ prefix
      setAdjustedSrc(src.replace("/portfolio/", "/"));
    }
  }, [src]);

  return <Image src={adjustedSrc} alt={props.alt || ''} {...props} />;
};

export default AssetImage;
