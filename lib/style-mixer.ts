import { STYLE_PRESETS } from "@/lib/catalogs";

export type StyleLayer = {
  styleId: string;
  strength: number;
};

export type StyleRecipe = {
  primary: StyleLayer;
  secondary: StyleLayer[];
  lock: boolean;
};

export function normalizeStyleRecipe(recipe: StyleRecipe): StyleRecipe {
  const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
  return {
    ...recipe,
    primary: { ...recipe.primary, strength: clamp(recipe.primary.strength) },
    secondary: recipe.secondary.slice(0, 3).map((layer) => ({ ...layer, strength: clamp(layer.strength) })),
  };
}

export function styleRecipePrompt(recipe: StyleRecipe) {
  const normalized = normalizeStyleRecipe(recipe);
  const describe = (layer: StyleLayer) => {
    const style = STYLE_PRESETS.find((item) => item.id === layer.styleId);
    return style ? `${style.nameEn} ${layer.strength}% — ${style.prompt}` : `Unknown style ${layer.styleId}`;
  };
  return [
    `PRIMARY STYLE: ${describe(normalized.primary)}`,
    ...normalized.secondary.map((layer, index) => `SECONDARY STYLE ${index + 1}: ${describe(layer)}`),
    normalized.lock ? "STYLE LOCK: preserve this style recipe, rendering language, palette and lighting character across connected shots." : "STYLE LOCK: off; per-scene variations are allowed.",
  ].join("\n");
}
