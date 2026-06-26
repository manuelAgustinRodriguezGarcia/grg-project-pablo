import { BrandCarousel } from "@/features/landing/components/BrandCarousel";
import { ContactSection } from "@/features/landing/components/ContactSection";
import { HeroSection } from "@/features/landing/components/HeroSection";
import { LandingFooter } from "@/features/landing/components/LandingFooter";
import { LandingHeader } from "@/features/landing/components/LandingHeader";
import { LandingScrollbarHide } from "@/features/landing/components/LandingScrollbarHide";
import styles from "./page.module.scss";

export default function Home() {
  return (
    <div className={styles.page}>
      <LandingScrollbarHide />
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
