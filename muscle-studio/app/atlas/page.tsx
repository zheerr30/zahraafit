import type { Metadata } from "next";
import { BackStudio } from "@/components/region/BackStudio";

export const metadata: Metadata = {
  title: "الأطلس التشريحي",
  description: "أطلس تشريحي ثلاثي الأبعاد للجسم كاملا من مجسمات Z-Anatomy الأصلية: كل عضلة مستقلة، مع العظام والأوتار والأربطة والأعصاب.",
};

export default function AtlasPage() {
  return <BackStudio hd />;
}
