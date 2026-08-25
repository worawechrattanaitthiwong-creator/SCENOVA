import { notFound, redirect } from "next/navigation";

const allowed = new Set(["images", "voices", "characters", "pets", "ambience", "plots", "videos"]);

export default async function LibraryKindPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!allowed.has(kind)) notFound();
  redirect(`/libraries?tab=${kind}`);
}
