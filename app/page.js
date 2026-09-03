import Footer from "./components/Footer";
import HeroSection from "./components/HeroSection";
import Navbar from "./components/Navbar";
import ProfileTabs from "./components/ProfileTabs";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <ProfileTabs />
      </main>
      <Footer />
    </>
  );
}
