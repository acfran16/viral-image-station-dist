export const promptRulePresets = [
  {
    id: "product-accuracy-priority",
    name: "Product accuracy priority",
    category: "Product",
    prompt: "Preserve product placement, color, construction, and visible design details before adding creative styling.",
  },
  {
    id: "back-print-only",
    name: "Back print only",
    category: "Apparel",
    prompt: "If the garment has artwork, place the graphic only on the back of the shirt. Keep the front plain unless explicitly requested.",
  },
  {
    id: "no-mirror-reflection",
    name: "No mirror/reflection",
    category: "QA",
    prompt: "Avoid mirror and reflection shots unless reflection accuracy is explicitly required.",
  },
  {
    id: "avoid-anatomy-risk",
    name: "Avoid anatomy-risk poses",
    category: "QA",
    prompt: "Avoid kneeling, crouching, deep squats, and visible seated lower-body poses. Prefer standing, walking, leaning, or waist-up crops.",
  },
  {
    id: "standing-leaning-only",
    name: "Standing/leaning poses",
    category: "Pose",
    prompt: "Use standing, walking, or leaning poses with natural weight distribution, normal knee alignment, and grounded feet.",
  },
  {
    id: "integrated-lighting",
    name: "Integrated lighting",
    category: "Lighting",
    prompt: "Do not copy harsh reference lighting directly. Blend model, garment, accessories, and background lighting into one believable scene.",
  },
  {
    id: "wardrobe-variation",
    name: "Wardrobe variation",
    category: "Styling",
    prompt: "Vary bottoms, shoes, accessories, bags, belts, chains, bracelets, and rings while keeping the product recognizable.",
  },
];
