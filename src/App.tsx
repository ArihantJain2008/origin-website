import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import ProductShowcase from "./components/ProductShowcase";
import Features from "./components/Features";
import ProjectDetection from "./components/ProjectDetection";
import EditorWorkflow from "./components/EditorWorkflow";
import CrossPlatform from "./components/CrossPlatform";
import UpdateSystem from "./components/UpdateSystem";
import HowItWorks from "./components/HowItWorks";
import Download from "./components/Download";
import Changelog from "./components/Changelog";
import FAQ from "./components/FAQ";
import Footer from "./components/Footer";

export default function App() {
  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#top"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      <Navbar />

      <main>
        <Hero />
        <ProductShowcase />
        <Features />
        <ProjectDetection />
        <EditorWorkflow />
        <CrossPlatform />
        <UpdateSystem />
        <HowItWorks />
        <Download />
        <Changelog />
        <FAQ />
      </main>

      <Footer />
    </div>
  );
}
