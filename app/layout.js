import { Inter } from "next/font/google";
import "./globals.css";
import CustomCursor from "./components/CustomCursor.jsx";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Ciaran Engelbrecht | Software Engineer",
  description:
    "Portfolio of Ciaran Engelbrecht, a software engineer specializing in full-stack development and solutions.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} bg-black text-white`}>
        <CustomCursor />
        {children}
      </body>
    </html>
  );
}
