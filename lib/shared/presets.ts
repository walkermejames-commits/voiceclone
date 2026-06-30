import type { DeliveryPreset } from "@/lib/shared/types";

export const DELIVERY_PRESET_OPTIONS: Array<{
  value: DeliveryPreset;
  label: string;
  description: string;
  paceMultiplier: number;
  pauseMultiplier: number;
}> = [
  {
    value: "neutral",
    label: "Neutral",
    description: "Balanced pacing for straightforward narration.",
    paceMultiplier: 1,
    pauseMultiplier: 1,
  },
  {
    value: "warm",
    label: "Warm",
    description: "Slightly slower with softer pauses for intimacy.",
    paceMultiplier: 0.96,
    pauseMultiplier: 1.12,
  },
  {
    value: "solemn",
    label: "Solemn",
    description: "Measured delivery with more space around clauses.",
    paceMultiplier: 0.9,
    pauseMultiplier: 1.28,
  },
  {
    value: "brisk",
    label: "Brisk",
    description: "Lighter pauses and a quicker read for momentum.",
    paceMultiplier: 1.08,
    pauseMultiplier: 0.84,
  },
  {
    value: "dramatic",
    label: "Dramatic",
    description: "Slightly slower with longer punctuation breaks.",
    paceMultiplier: 0.94,
    pauseMultiplier: 1.36,
  },
];

export function getPresetConfig(preset: DeliveryPreset) {
  return (
    DELIVERY_PRESET_OPTIONS.find((option) => option.value === preset) ??
    DELIVERY_PRESET_OPTIONS[0]
  );
}
