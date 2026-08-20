import type { Metadata } from "next";

import { getMediaLibrary } from "@/lib/media/get-media";

import { MediaLibrary } from "./media-library";

export const metadata: Metadata = { title: "Media Library" };

export default async function AdminMediaPage() {
  const media = await getMediaLibrary();

  return (
    <div className="container py-10">
      <h1 className="mb-6 font-heading text-2xl">Media Library</h1>
      <MediaLibrary initialMedia={media} />
    </div>
  );
}
