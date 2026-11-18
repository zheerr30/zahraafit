import type { Metadata } from "next";
import { BackStudio } from "@/components/region/BackStudio";

export const metadata: Metadata = {
  title: "الظهر والكتفان",
  description: "نموذج تشريحي ثلاثي الأبعاد لعضلات الظهر والكتفين وعظامهما وأوتارهما وأعصابهما، مع بطاقات عربية لكل عضلة.",
};

export default function BackPage() {
  return <BackStudio initialRegion="back" hd />;
}
