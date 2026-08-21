import type { Metadata } from "next";

import { getAdminSocialGalleryImages } from "@/lib/admin/get-social-gallery";
import { getMediaLibrary } from "@/lib/media/get-media";

import { GalleryImageRow } from "./gallery-image-row";
import { NewGalleryImageForm } from "./new-gallery-image-form";

export const metadata: Metadata = { title: "Social Gallery" };

export default async function AdminSocialGalleryPage() {
  const [images, media] = await Promise.all([getAdminSocialGalleryImages(), getMediaLibrary()]);

  return (
    <div className="container flex flex-col gap-6 py-10">
      <div>
        <h1 className="font-heading text-2xl">Social Gallery</h1>
        <p className="text-sm text-muted-foreground">
          Curated images shown in the homepage gallery — the mock behind Module 18&apos;s Instagram
          integration abstraction until a real feed is connected.
        </p>
      </div>

      <NewGalleryImageForm media={media} />

      {images.length === 0 ? (
        <p className="text-sm text-muted-foreground">No gallery images yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {images.map((image) => (
            <GalleryImageRow key={`${image.id}-${image.updated_at}`} image={image} />
          ))}
        </div>
      )}
    </div>
  );
}
