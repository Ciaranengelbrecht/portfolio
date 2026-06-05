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
  title: "Ciaran Engelbrecht | Software Developer & ICT Professional",
  description:
    "Portfolio of Ciaran Engelbrecht, a software developer and ICT professional focused on software, systems, automation, support, and practical technology solutions.",
  keywords: ["Software Developer", "ICT Professional", "Full Stack Developer", "Automation", "Systems", "Portfolio"],
  authors: [{ name: "Ciaran Engelbrecht" }],
  openGraph: {
    title: "Ciaran Engelbrecht | Software Developer & ICT Professional",
    description: "Portfolio of Ciaran Engelbrecht, focused on software development, ICT systems, automation, and practical technical solutions.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`scroll-smooth ${outfit.variable} ${jetbrainsMono.variable}`}>
      <body className={`${outfit.className} bg-surface-900 text-white antialiased`}>
        <div className="fixed inset-0 bg-grid opacity-30 pointer-events-none z-0" />
        <div className="fixed inset-0 noise-overlay opacity-[0.08] pointer-events-none z-0" />
        
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
