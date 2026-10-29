import { createContext } from 'react';
import type { Product } from '../types';

export type ProductInput = Omit<Product, 'id' | 'wholesalerId' | 'wholesalerName' | 'image' | 'photos'> & {
  id?: string;
  imageFiles: File[];
  existingPhotos: string[];
};

export type WholesalerDirectoryEntry = {
  id: string;
  name: string;
  address: string;
  shopNumber: string | null;
  contactName: string;
  contactPhone: string;
  logoPath: string | null;
};

export type CatalogContextValue = {
  products: Product[];
  wholesalers: WholesalerDirectoryEntry[];
  loading: boolean;
  error: string | null;
  refreshCatalog: () => Promise<void>;
  saveProduct: (input: ProductInput) => Promise<void>;
  deleteProduct: (product: Product) => Promise<void>;
  toggleProductActive: (product: Product) => Promise<void>;
};

export const CatalogContext = createContext<CatalogContextValue | null>(null);
