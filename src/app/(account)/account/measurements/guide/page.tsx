import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getMeasurementFieldDefinitions,
  groupFieldsByCategory,
} from "@/lib/measurements/get-field-definitions";

export const metadata: Metadata = { title: "Measurement Guide" };

export default async function MeasurementGuidePage() {
  const fields = await getMeasurementFieldDefinitions();
  const groups = groupFieldsByCategory(fields);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl">Measurement Guide</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How to take each measurement. Use a soft tape measure and keep it snug but not tight.
        </p>
      </div>

      {groups.map((group) => (
        <Card key={group.category}>
          <CardHeader>
            <CardTitle as="h1" className="text-base">{group.category}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            {group.items.map((field) => (
              <div key={field.key} className="flex flex-col gap-2">
                {field.guide_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={field.guide_image_url}
                    alt={field.label}
                    className="aspect-video w-full rounded-lg object-cover"
                  />
                ) : null}
                {field.guide_video_url ? (
                  <a
                    href={field.guide_video_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs text-primary underline-offset-4 hover:underline"
                  >
                    Watch video guide
                  </a>
                ) : null}
                <p className="font-medium">{field.label}</p>
                {field.description ? (
                  <p className="text-sm text-muted-foreground">{field.description}</p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
