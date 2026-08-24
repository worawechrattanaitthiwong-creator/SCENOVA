import { notFound } from "next/navigation";
import LibraryCategory from "@/components/library-category";

const allowed = new Set(["images", "voices", "characters", "pets", "ambience", "plots", "videos"]);

export default async function LibraryKindPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!allowed.has(kind)) notFound();
  return <LibraryCategory kind={kind} />;
}
