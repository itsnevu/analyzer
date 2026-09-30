/**
 * The four classes the legacy detector was trained on, in chart stacking order
 * (bottom to top). Safe for client code.
 *
 * Colors were checked with the dataviz palette validator on the white card
 * surface, in this order: every adjacent pair clears the colorblind and
 * normal-vision floors. The yellow sits below 3:1 contrast, so every chart
 * using it ships a legend and a table view.
 */
export const DATASET_CLASSES = ["HOAX", "INFORMATION", "DISINFORMATION", "FACT"] as const;
export type DatasetClass = (typeof DATASET_CLASSES)[number];

export const CLASS_META: Record<DatasetClass, { label: string; color: string }> = {
  HOAX: { label: "Hoax", color: "#b91c1c" },
  INFORMATION: { label: "Information", color: "#2a78d6" },
  DISINFORMATION: { label: "Disinformation", color: "#eda100" },
  FACT: { label: "Fact", color: "#15803d" },
};

export function isDatasetClass(label: string): label is DatasetClass {
  return (DATASET_CLASSES as readonly string[]).includes(label);
}
