import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import CustomCursor from "./components/CustomCursor";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata = {
  title: "Ciaran Engelbrecht | Software Engineer",
  description:
    "Portfolio of Ciaran Engelbrecht, a software engineer specializing in full-stack development, AI, and innovative software solutions.",
  keywords: ["Software Engineer", "Full Stack Developer", "React", "Python", "JavaScript", "Portfolio"],
  authors: [{ name: "Ciaran Engelbrecht" }],
  openGraph: {
    title: "Ciaran Engelbrecht | Software Engineer",
    description: "Portfolio of Ciaran Engelbrecht, a software engineer specializing in full-stack development and solutions.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`scroll-smooth ${inter.variable} ${spaceGrotesk.variable}`}>
      <body className={`${inter.className} bg-surface-900 text-white antialiased`}>
        {/* Custom cursor for desktop */}
        <CustomCursor />
        
        {/* Background gradient overlay */}
        <div className="fixed inset-0 bg-mesh-gradient pointer-events-none z-0" />
        
        {/* Subtle noise texture */}
        <div className="fixed inset-0 noise-overlay opacity-[0.015] pointer-events-none z-0" />
        
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
