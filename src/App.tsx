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
import { useEffect } from "react";
import Footer from "./components/Footer";
import Feedback from "./components/Feedback";
import Admin from "./components/Admin";

export default function App() {
  const isFeedbackPage = window.location.pathname === "/feedback";
  const isAdminPage = window.location.pathname.startsWith("/admin");

  useEffect(() => {
    document.title = isAdminPage ? "Admin — Origin" : isFeedbackPage ? "Feedback & Support — Origin" : "Origin — Your code. One place.";
    const description = isAdminPage
      ? "Origin administration."
      : isFeedbackPage
      ? "Report bugs, request features, ask questions, and help shape the future of Origin."
      : "Origin is a developer workspace that organizes your projects and gets you coding faster.";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;
  }, [isFeedbackPage, isAdminPage]);

  if (isAdminPage) return <Admin />;

  if (isFeedbackPage) {
    return (
      <div className="min-h-screen bg-canvas">
        <Navbar />
        <main><Feedback /></main>
        <Footer />
      </div>
    );
  }

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
