import { BrandCarousel } from "@/features/landing/components/BrandCarousel";
import { CategoryShowcase } from "@/features/landing/components/CategoryShowcase";
import { ContactSection } from "@/features/landing/components/ContactSection";
import { HeroSection } from "@/features/landing/components/HeroSection";
import { LandingFooter } from "@/features/landing/components/LandingFooter";
import { LandingHeader } from "@/features/landing/components/LandingHeader";
import { LandingScrollbarHide } from "@/features/landing/components/LandingScrollbarHide";
import { LocalBusinessJsonLd } from "@/features/landing/components/LocalBusinessJsonLd";
import styles from "./page.module.scss";

export default function Home() {
  return (
    <div className={styles.page}>
      <LocalBusinessJsonLd />
      <LandingScrollbarHide />
      <LandingHeader />
      <main className={styles.main}>
        <HeroSection />
        <CategoryShowcase />
        <BrandCarousel />
        <ContactSection />
      </main>
      <LandingFooter />
    </div>
  );
}
