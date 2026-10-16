// The landing page.
import Hero from "../components/Hero";
import WhoWeServe from "../components/WhoWeServe";
import Services from "../components/Services";
import Compare from "../components/Compare";
import Rooms from "../components/Rooms";
import HowItWorks from "../components/HowItWorks";
import Plans from "../components/Plans";
import Gallery from "../components/Gallery";
import WhyUs from "../components/WhyUs";
import Lagos from "../components/Lagos";
import JoinTeam from "../components/JoinTeam";
import FAQ from "../components/FAQ";
import BlogTeaser from "../components/BlogTeaser";

export default function Home() {
  return (
    <>
      <title>Cleaniq Nigeria — Professional Cleaning in Lagos</title>
      <meta name="description" content="Professional regular, deep and post-construction cleaning across Lagos. Book online in minutes and pay securely with Paystack." />
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
      <BlogTeaser />
      <FAQ />
    </>
  );
}
