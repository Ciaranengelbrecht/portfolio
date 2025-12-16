import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ 
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
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
    <html lang="en" className={`scroll-smooth ${outfit.variable} ${jetbrainsMono.variable}`}>
      <body className={`${outfit.className} bg-surface-900 text-white antialiased`}>
        {/* Background gradient overlay */}
        <div className="fixed inset-0 bg-mesh-gradient pointer-events-none z-0" />
        
        {/* Subtle noise texture */}
        <div className="fixed inset-0 noise-overlay opacity-[0.02] pointer-events-none z-0" />
        
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
