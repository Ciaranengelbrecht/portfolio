// next.config.js
const isCustomDomain = process.env.DEPLOY_ENV === "CUSTOM_DOMAIN";

module.exports = {
  output: "export", // Enable static export
  images: {
    unoptimized: true, // This is required for static export
  },
  // Only use basePath for GitHub Pages, not for custom domain
  ...(isCustomDomain ? {} : { basePath: "/portfolio" }),
  trailingSlash: true,
};
