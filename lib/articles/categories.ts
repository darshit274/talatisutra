import { FileText, Map, Landmark, GraduationCap, Scale, Download } from "lucide-react";
import { ArticleCategory } from "@prisma/client";

export const CATEGORY_ORDER: ArticleCategory[] = [
  "GR_CIRCULARS",
  "LAND_RECORDS",
  "PANCHAYAT_ADMINISTRATION",
  "EXAM_PREPARATION",
  "SALARY_SERVICE_RULES",
  "FORMS_DOWNLOADS",
];

export const CATEGORY_META: Record<
  ArticleCategory,
  {
    label: string;
    icon: typeof FileText;
    shortDescription: string;
    servicesDescription: string;
    tags: [string, string, string];
    path: string;
  }
> = {
  GR_CIRCULARS: {
    label: "GR & Circular archive",
    icon: FileText,
    shortDescription:
      "Government resolutions and circulars from the Revenue and Panchayat departments, dated and linked to the official source.",
    servicesDescription:
      "Government resolutions and circulars from the Revenue and Panchayat departments, dated and linked to the official source.",
    tags: ["Revenue Dept.", "Panchayat Dept.", "Yearly index"],
    path: "/articles?category=GR_CIRCULARS",
  },
  LAND_RECORDS: {
    label: "Land record guides",
    icon: Map,
    shortDescription:
      "Procedure notes for 7/12, 8-A, varsai, mutation entries and e-Dhara, written for the village office.",
    servicesDescription:
      "Procedure notes for 7/12, 8-A, varsai, mutation entries and e-Dhara, written for the village office.",
    tags: ["7/12 & 8-A", "Varsai", "Mutation (6)"],
    path: "/articles?category=LAND_RECORDS",
  },
  PANCHAYAT_ADMINISTRATION: {
    label: "Panchayat administration",
    icon: Landmark,
    shortDescription:
      "Gram Sabha, tax registers, accounts and the day-to-day duties of the Mantri role.",
    servicesDescription:
      "Gram Sabha, tax registers, accounts and the day-to-day duties of the Mantri role.",
    tags: ["Gram Sabha", "House tax", "Accounts"],
    path: "/articles?category=PANCHAYAT_ADMINISTRATION",
  },
  EXAM_PREPARATION: {
    label: "Exam preparation",
    icon: GraduationCap,
    shortDescription:
      "Syllabus, subject notes, previous papers and mock tests for the Talati-cum-Mantri recruitment exam.",
    servicesDescription:
      "Syllabus, subject notes, previous papers and mock tests for the Talati-cum-Mantri recruitment exam.",
    tags: ["Syllabus", "Past papers", "Mock tests"],
    path: "/articles?category=EXAM_PREPARATION",
  },
  SALARY_SERVICE_RULES: {
    label: "Salary & service rules",
    icon: Scale,
    shortDescription:
      "Pay scales, DA revisions, leave, transfer and promotion rules explained in plain language.",
    servicesDescription:
      "Pay scales, DA revisions, leave, transfer and promotion rules explained in plain language.",
    tags: ["Pay & DA", "Leave", "Transfers"],
    path: "/articles?category=SALARY_SERVICE_RULES",
  },
  FORMS_DOWNLOADS: {
    label: "Forms & downloads",
    icon: Download,
    shortDescription:
      "Ready-to-print forms and register formats used at the gram panchayat, in Gujarati and English.",
    servicesDescription:
      "Ready-to-print forms and register formats used at the gram panchayat, in Gujarati and English.",
    tags: ["Certificates", "Registers", "Applications"],
    path: "/articles?category=FORMS_DOWNLOADS",
  },
};
