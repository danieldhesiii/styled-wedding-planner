import type { StylePreset, SampleVenue } from "./types";

// Four style presets covering the common UK looks named in the Build Plan
// ("Garden Romance", rustic barn, etc.). Palettes drive the preview wash and the
// catalogue matching.
export const STYLES: StylePreset[] = [
  {
    id: "rustic_barn",
    name: "Rustic Barn",
    tagline: "Warm wood, foliage and festoon light",
    palette: ["#8a9a82", "#b98a6a", "#efe7db", "#6b4f3a"],
    wash: "rgba(138, 154, 130, 0.22)",
  },
  {
    id: "garden_romance",
    name: "Garden Romance",
    tagline: "Blush blooms, soft linen, candlelight",
    palette: ["#d9b7ad", "#efe7db", "#c9a0a0", "#8a9a82"],
    wash: "rgba(217, 183, 173, 0.24)",
  },
  {
    id: "classic_elegance",
    name: "Classic Elegance",
    tagline: "Ivory, gold and tall arrangements",
    palette: ["#f3ecdf", "#a67c52", "#d8c7ad", "#2b2622"],
    wash: "rgba(166, 124, 82, 0.20)",
  },
  {
    id: "modern_minimal",
    name: "Modern Minimal",
    tagline: "Clean lines, muted tones, sculptural stems",
    palette: ["#d7d2c8", "#2b2622", "#b0a99c", "#8a9a82"],
    wash: "rgba(43, 38, 34, 0.16)",
  },
];

export function getStyle(id: string): StylePreset {
  return STYLES.find((s) => s.id === id) ?? STYLES[0];
}

// Sample venues so a couple can try the loop without uploading a photo.
// In production these are real uploaded/pre-photographed rooms.
export const SAMPLE_VENUES: SampleVenue[] = [
  {
    id: "oak_barn",
    name: "The Oak Barn",
    area: "Great Dunmow, Essex",
    kind: "Dry-hire barn",
    gradient: "linear-gradient(135deg, #6b4f3a 0%, #8a6f52 45%, #c9a878 100%)",
    image: "/img/venues/oak_barn.png",
  },
  {
    id: "manor_orangery",
    name: "Hedingham Manor Orangery",
    area: "Halstead, Essex",
    kind: "Orangery",
    gradient: "linear-gradient(135deg, #7d8a74 0%, #a9b39c 50%, #e7e3d6 100%)",
    image: "/img/venues/manor_orangery.png",
  },
  {
    id: "county_hall",
    name: "Hertford County Hall",
    area: "Hertford, Herts",
    kind: "Historic hall",
    gradient: "linear-gradient(135deg, #3a3330 0%, #6c5f52 50%, #b7a488 100%)",
    image: "/img/venues/county_hall.jpg",
  },
];

export function getVenue(id: string): SampleVenue {
  return SAMPLE_VENUES.find((v) => v.id === id) ?? SAMPLE_VENUES[0];
}
