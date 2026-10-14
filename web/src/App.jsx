// Cleaniq Nigeria — landing page.
import { MotionConfig } from "framer-motion";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import WhoWeServe from "./components/WhoWeServe";
import Services from "./components/Services";
import Compare from "./components/Compare";
import Rooms from "./components/Rooms";
import HowItWorks from "./components/HowItWorks";
import Plans from "./components/Plans";
import Gallery from "./components/Gallery";
import WhyUs from "./components/WhyUs";
import Lagos from "./components/Lagos";
import JoinTeam from "./components/JoinTeam";
import FAQ from "./components/FAQ";
import Footer from "./components/Footer";
import WhatsAppButton from "./components/WhatsAppButton";

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Navbar />
      <main>
        <Hero />
        <WhoWeServe />
        <Services />
        <Compare />
        <Rooms />
        <HowItWorks />
        <Plans />
        <Gallery />
        <WhyUs />
        <Lagos />
        <JoinTeam />
        <FAQ />
      </main>
      <Footer />
      <WhatsAppButton />
    </MotionConfig>
  );
}
