export const categories = ['Dal/ Pulses', 'Flour/ Atta', 'Grains', 'Oils & Ghee', 'Spices / masalas', 'Dry fruits'] as const;
export const grades = ['A', 'B', 'C'] as const;
export const units = ['kg', '25kg', 'ton', 'litres'] as const;

export type ProductCategory = (typeof categories)[number];
export type ProductGrade = (typeof grades)[number];
export type ProductUnit = (typeof units)[number];
