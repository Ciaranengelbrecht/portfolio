"use client";
import React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";

const AssetImage = ({ src, ...props }) => {
  const pathname = usePathname();
  const isCustomDomain =
    typeof window !== "undefined" &&
    !window.location.hostname.includes("github.io");

  // If it's a custom domain, or the path already contains /portfolio, don't add prefix
  const adjustedSrc =
    isCustomDomain || src.includes("/portfolio/")
      ? src.replace("/portfolio/", "/") // Remove /portfolio/ if on custom domain
      : src; // Keep original src

  return <Image src={adjustedSrc} {...props} />;
};

export default AssetImage;
