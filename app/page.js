import Footer from "./components/Footer";
import HeroSection from "./components/HeroSection";
import Navbar from "./components/Navbar";
import ProfileTabs from "./components/ProfileTabs";

export default function Home() {
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <HeroSection />
        <ProfileTabs />
      </main>
      <Footer />
    </>
  );
}
