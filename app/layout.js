import { Manrope, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
  style: ["normal", "italic"],
});

export const metadata = {
  metadataBase: new URL("https://ciaranengelbrecht.com"),
  title: "Ciaran Engelbrecht | ICT Support, Systems & Networks",
  description:
    "Portfolio of Ciaran Engelbrecht, a Perth ICT professional with experience in support, systems and endpoint administration, networking, Microsoft 365, security, and practical automation.",
  keywords: ["ICT Support", "Desktop Support", "Systems Administration", "Network Support", "Microsoft 365", "Automation", "Perth"],
  authors: [{ name: "Ciaran Engelbrecht" }],
  openGraph: {
    title: "Ciaran Engelbrecht | ICT Support, Systems & Networks",
    description: "Perth ICT professional focused on support, endpoint environments, systems, networking, and practical automation.",
    type: "website",
    url: "https://ciaranengelbrecht.com",
    siteName: "Ciaran Engelbrecht",
  },
  twitter: {
    card: "summary",
    title: "Ciaran Engelbrecht | ICT Support, Systems & Networks",
    description: "Perth ICT professional focused on support, endpoint environments, systems, networking, and practical automation.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`scroll-smooth ${manrope.variable} ${sourceSerif.variable}`}>
      <body className={`${manrope.className} bg-[#10110f] text-[#f1eee7] antialiased`}>{children}</body>
    </html>
  );
}
