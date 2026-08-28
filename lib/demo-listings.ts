export type DemoListing = {
  id: "clear-fit" | "verify-first" | "rule-conflict";
  label: string;
  description: string;
  listingText: string;
};

export const demoListings: DemoListing[] = [
  {
    id: "clear-fit",
    label: "Clear fit",
    description: "Strong match, with one important fact to verify.",
    listingText: `Synthetic example — not a live listing
28 Alder Lane, Northfield, MI 48000
$382,000 | 3 beds | 2 baths | 1,610 sq ft
Status: Active
Days on market: 41

Fictional listing copy: Brick home with a two-car garage, fenced yard, hardwood floors, and a dedicated home office. The kitchen was updated in 2021. Seller is relocating. Roof age is not stated.`,
  },
  {
    id: "verify-first",
    label: "Missing evidence",
    description: "Appealing language, but critical details are absent.",
    listingText: `Synthetic example — not a live listing
704 Juniper Street, Northfield, MI 48000
$347,500 | 3 beds | 1.5 baths | 1,480 sq ft
Days on market: 18

Fictional listing copy: Charming home with flexible living space, a fenced yard, and a detached garage. Recent cosmetic updates throughout. Buyer should verify listing status, property taxes, roof age, and permit history.`,
  },
  {
    id: "rule-conflict",
    label: "Rule conflict",
    description: "A clear deal-breaker should stop the workflow.",
    listingText: `Synthetic example — not a live listing
116 Harbor View, Northfield, MI 48000
$468,000 | 4 beds | 3 baths | 2,120 sq ft
Status: Active
Days on market: 9

Fictional listing copy: Cash only. Tenant occupied through December. Renovated kitchen, attached garage, and limited showing availability. Property is offered as-is.`,
  },
];

export function getDemoListing(id: unknown) {
  return demoListings.find((demo) => demo.id === id) ?? null;
}
