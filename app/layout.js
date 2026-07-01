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
  title: "Ciaran Engelbrecht | ICT Support, Systems & Automation",
  description:
    "Portfolio of Ciaran Engelbrecht, an ICT professional focused on support, desktop and endpoint environments, Microsoft 365, networking, systems administration, automation, data, and practical development projects.",
  keywords: ["ICT Support", "Desktop Support", "Systems Administrator", "Network Support", "Microsoft 365", "Automation", "Portfolio"],
  authors: [{ name: "Ciaran Engelbrecht" }],
  openGraph: {
    title: "Ciaran Engelbrecht | ICT Support, Systems & Automation",
    description: "Portfolio of Ciaran Engelbrecht, focused on ICT support, endpoint environments, systems, networking, automation, data, and practical technical solutions.",
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
