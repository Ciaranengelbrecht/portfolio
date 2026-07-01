"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";

const AssetImage = ({ src, ...props }) => {
  const [adjustedSrc, setAdjustedSrc] = useState(src);

  useEffect(() => {
    const isPortfolioBasePath = window.location.pathname.startsWith("/portfolio");

    if (isPortfolioBasePath && !src.startsWith("/portfolio/")) {
      setAdjustedSrc(`/portfolio${src.startsWith("/") ? src : `/${src}`}`);
    } else if (!isPortfolioBasePath && src.startsWith("/portfolio/")) {
      setAdjustedSrc(src.replace("/portfolio/", "/"));
    }
  }, [src]);

  return <Image src={adjustedSrc} alt={props.alt || ''} {...props} />;
};

export default AssetImage;
