import { BrandCarousel } from "@/features/landing/components/BrandCarousel";
import { ContactSection } from "@/features/landing/components/ContactSection";
import { HeroSection } from "@/features/landing/components/HeroSection";
import { LandingFooter } from "@/features/landing/components/LandingFooter";
import { LandingHeader } from "@/features/landing/components/LandingHeader";
import styles from "./page.module.scss";

export default function Home() {
  return (
    <div className={styles.page}>
      <LandingHeader />
      <main className={styles.main}>
        <HeroSection />
        <BrandCarousel />
        <ContactSection />
      </main>
      <LandingFooter />
    </div>
  );
}
