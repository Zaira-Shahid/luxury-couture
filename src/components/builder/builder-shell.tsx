"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createConfiguration, updateConfiguration } from "@/features/builder/actions";
import type { BuilderOptionSets } from "@/lib/builder/get-options";
import type { ProductWithImages } from "@/lib/catalog/get-products";
import type { BuilderConfiguration, InspirationImage } from "@/types/database";

import { NotesInspirationStep } from "./notes-inspiration-step";
import { OptionStep } from "./option-step";
import { PreviewPanel } from "./preview-panel";
import { ProgressIndicator } from "./progress-indicator";
import { ReviewStep } from "./review-step";
import { StyleStep } from "./style-step";

const STEPS = [
  "Style",
  "Fabric",
  "Embroidery",
  "Colour",
  "Sleeve",
  "Neckline",
  "Dupatta",
  "Notes",
  "Review",
] as const;

type Selections = {
  productId: string | null;
  fabricId: string | null;
  embroideryTypeId: string | null;
  colourId: string | null;
  sleeveStyleId: string | null;
  necklineId: string | null;
  dupattaOptionId: string | null;
  customNotes: string | null;
};

function toSelections(config: BuilderConfiguration | null, initialProductId?: string | null): Selections {
  return {
    productId: config?.product_id ?? initialProductId ?? null,
    fabricId: config?.fabric_id ?? null,
    embroideryTypeId: config?.embroidery_type_id ?? null,
    colourId: config?.colour_id ?? null,
    sleeveStyleId: config?.sleeve_style_id ?? null,
    necklineId: config?.neckline_id ?? null,
    dupattaOptionId: config?.dupatta_option_id ?? null,
    customNotes: config?.custom_notes ?? null,
  };
}

export function BuilderShell({
  initialConfig,
  initialImages,
  options,
  products,
  isSignedIn,
  initialProductId,
  occasionLabels,
}: {
  initialConfig: BuilderConfiguration | null;
  initialImages: InspirationImage[];
  options: BuilderOptionSets;
  products: ProductWithImages[];
  isSignedIn: boolean;
  initialProductId?: string | null;
  /**
   * Module 23 builder guidance, keyed by builder-option table. Only the
   * fabric, colour and embroidery steps have curated occasion data, so
   * the other steps simply receive nothing and render unchanged.
   */
  occasionLabels?: {
    fabrics?: Record<string, string[]>;
    colours?: Record<string, string[]>;
    embroidery_types?: Record<string, string[]>;
  };
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selections, setSelections] = useState<Selections>(
    toSelections(initialConfig, initialProductId)
  );
  const [configId, setConfigId] = useState<string | null>(initialConfig?.id ?? null);
  const [token, setToken] = useState<string | null>(initialConfig?.share_token ?? null);
  const [images, setImages] = useState<InspirationImage[]>(initialImages);
  const [estimatedPrice, setEstimatedPrice] = useState(Number(initialConfig?.estimated_price ?? 0));
  const [isClaimed, setIsClaimed] = useState(!!initialConfig?.customer_id);
  const [isPending, startTransition] = useTransition();

  function updateSelection<K extends keyof Selections>(key: K, value: Selections[K]) {
    setSelections((prev) => ({ ...prev, [key]: value }));
  }

  function persist(next: Selections, onDone?: () => void) {
    startTransition(async () => {
      const result = configId
        ? await updateConfiguration(configId, token!, next)
        : await createConfiguration(next);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      setEstimatedPrice(Number(result.data.estimated_price ?? 0));
      setIsClaimed(!!result.data.customer_id);

      if (!configId) {
        setConfigId(result.data.id);
        setToken(result.data.share_token);
        router.replace(`/builder/${result.data.id}?token=${result.data.share_token}`, {
          scroll: false,
        });
      }
      onDone?.();
    });
  }

  function goNext() {
    persist(selections, () => setStep((s) => Math.min(s + 1, STEPS.length - 1)));
  }
  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }
  function saveAndExit() {
    persist(selections, () => toast.success("Design saved — this page's link will bring you back to it."));
  }

  return (
    <div className="container py-10">
      <ProgressIndicator steps={STEPS} currentStep={step} />

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          {step === 0 ? (
            <StyleStep
              products={products}
              selectedId={selections.productId}
              onSelect={(id) => updateSelection("productId", id)}
            />
          ) : null}
          {step === 1 ? (
            <OptionStep
              title="Choose a Fabric"
              description="The base fabric for your piece."
              options={options.fabrics}
              selectedId={selections.fabricId}
              onSelect={(id) => updateSelection("fabricId", id)}
              occasionLabels={occasionLabels?.fabrics}
            />
          ) : null}
          {step === 2 ? (
            <OptionStep
              title="Choose Embroidery"
              description="Hand embroidery technique."
              options={options.embroidery}
              selectedId={selections.embroideryTypeId}
              onSelect={(id) => updateSelection("embroideryTypeId", id)}
              occasionLabels={occasionLabels?.embroidery_types}
            />
          ) : null}
          {step === 3 ? (
            <OptionStep
              title="Choose a Colour"
              description="The primary colourway."
              options={options.colours}
              selectedId={selections.colourId}
              onSelect={(id) => updateSelection("colourId", id)}
              occasionLabels={occasionLabels?.colours}
            />
          ) : null}
          {step === 4 ? (
            <OptionStep
              title="Choose a Sleeve Style"
              description="Sleeve length and shape."
              options={options.sleeveStyles}
              selectedId={selections.sleeveStyleId}
              onSelect={(id) => updateSelection("sleeveStyleId", id)}
            />
          ) : null}
          {step === 5 ? (
            <OptionStep
              title="Choose a Neckline"
              description="Neckline shape."
              options={options.necklines}
              selectedId={selections.necklineId}
              onSelect={(id) => updateSelection("necklineId", id)}
            />
          ) : null}
          {step === 6 ? (
            <OptionStep
              title="Choose a Dupatta"
              description="Dupatta style, or none at all."
              options={options.dupattaOptions}
              selectedId={selections.dupattaOptionId}
              onSelect={(id) => updateSelection("dupattaOptionId", id)}
            />
          ) : null}
          {step === 7 ? (
            <NotesInspirationStep
              customNotes={selections.customNotes ?? ""}
              onNotesChange={(value) => updateSelection("customNotes", value)}
              configId={configId}
              token={token}
              images={images}
              onImagesChange={setImages}
            />
          ) : null}
          {step === 8 ? (
            <ReviewStep configId={configId} token={token} isSignedIn={isSignedIn} isClaimed={isClaimed} />
          ) : null}

          <div className="mt-8 flex items-center justify-between">
            <Button type="button" variant="ghost" disabled={step === 0} onClick={goBack}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={isPending} onClick={saveAndExit}>
                Save Draft
              </Button>
              {step < STEPS.length - 1 ? (
                <Button type="button" disabled={isPending} onClick={goNext}>
                  {isPending ? "Saving…" : "Next"}
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <PreviewPanel
            selections={selections}
            options={options}
            products={products}
            estimatedPrice={estimatedPrice}
          />
        </div>
      </div>
    </div>
  );
}
