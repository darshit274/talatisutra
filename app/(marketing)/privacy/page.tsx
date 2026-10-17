import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="font-heading text-3xl font-semibold">Privacy</h1>
      <p className="mt-4 text-muted-foreground">
        This page is coming soon. Talatisutra is an independent information resource and
        is not an official website of the Government of Gujarat or the Government of
        India.
      </p>
    </div>
  );
}
