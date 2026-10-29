export const categories = ['Grains', 'Rice', 'Wheat', 'Spices', 'Dry Fruits'] as const;
export const grades = ['A', 'B', 'C'] as const;
export const units = ['kg', '25kg', 'ton'] as const;

export type ProductCategory = (typeof categories)[number];
export type ProductGrade = (typeof grades)[number];
export type ProductUnit = (typeof units)[number];
