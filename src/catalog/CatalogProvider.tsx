import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/useAuth';
import { products as demoProducts } from '../data/products';
import { wholesalers as demoWholesalers } from '../data/demo';
import { compressProductImage } from '../lib/imageCompression';
import { supabase } from '../lib/env';
import type { Product } from '../types';
import { CatalogContext } from './CatalogContext';
import type { CatalogContextValue, ProductInput, WholesalerDirectoryEntry } from './CatalogContext';

const demoProductsKey = 'kirana-demo-products';

const demoDirectory: WholesalerDirectoryEntry[] = demoWholesalers.map((wholesaler) => ({
  id: demoWholesalerId(wholesaler.id),
  name: wholesaler.name,
  address: wholesaler.location,
  shopNumber: 'Market shop',
  contactName: 'Marketplace seller',
  contactPhone: 'Contact after order',
  logoPath: null,
}));

function readDemoProducts(): Product[] {
  const stored = localStorage.getItem(demoProductsKey);
  if (!stored) {
    return demoProducts.map((product) => ({ ...product, wholesalerId: demoWholesalerId(product.wholesalerId) }));
  }
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed)) throw new Error('Saved demo products are invalid. Clear the kirana-demo-products browser storage key.');
  return parsed as Product[];
}

function productFromDatabase(
  row: {
    id: string;
    wholesaler_id: string;
    name: string;
    category: string;
    grade: Product['grade'];
    unit: Product['unit'];
    price: number;
    stock: number;
    min_order: number;
    is_active: boolean;
    photos: string[];
  },
  seller: WholesalerDirectoryEntry | undefined,
): Product {
  const photoUrls = row.photos.map((path) => supabase?.storage.from('product-images').getPublicUrl(path).data.publicUrl ?? path);
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    grade: row.grade,
    price: Number(row.price),
    unit: row.unit,
    stock: Number(row.stock),
    minOrder: Number(row.min_order),
    wholesalerId: row.wholesaler_id,
    wholesalerName: seller?.name ?? 'Verified wholesaler',
    isActive: row.is_active,
    image: photoUrls[0] ?? '',
    photos: row.photos,
  };
}

function demoWholesalerId(id: string) {
  const knownIds: Record<string, string> = {
    'w-1': 'demo-wholesaler',
    'w-2': 'demo-kamal',
    'w-3': 'demo-riverdale',
  };
  return knownIds[id] ?? id;
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [wholesalers, setWholesalers] = useState<WholesalerDirectoryEntry[]>(demoDirectory);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!supabase) {
        setProducts(readDemoProducts());
        setWholesalers(demoDirectory);
        return;
      }

      const { data: directory, error: directoryError } = await supabase
        .from('wholesaler_directory')
        .select('*')
        .order('business_name');
      if (directoryError) throw directoryError;
      const entries: WholesalerDirectoryEntry[] = directory.map((entry) => ({
        id: entry.id,
        name: entry.business_name,
        address: entry.address,
        shopNumber: entry.shop_number,
        contactName: entry.contact_name,
        contactPhone: entry.contact_phone,
        logoPath: entry.logo_path,
      }));
      setWholesalers(entries);

      const { data, error: productsError } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (productsError) throw productsError;
      const sellerById = new Map(entries.map((entry) => [entry.id, entry]));
      setProducts(data.map((row) => productFromDatabase(row, sellerById.get(row.wholesaler_id))));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the catalogue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const saveProduct = useCallback(async (input: ProductInput) => {
    if (!account || account.role !== 'wholesaler' || account.status !== 'approved' || !account.profileCompleted) {
      throw new Error('An approved wholesaler with a completed profile is required to manage products.');
    }

    const compressedFiles = await Promise.all(input.imageFiles.slice(0, 5).map(compressProductImage));
    const currentProduct = input.id ? products.find((product) => product.id === input.id) : undefined;
    if (input.id && !currentProduct) throw new Error('This product is no longer available. Refresh and try again.');
    const existingPhotos = compressedFiles.length ? input.existingPhotos : (currentProduct?.photos ?? input.existingPhotos);
    const finalPhotoCount = compressedFiles.length + existingPhotos.length;
    if (finalPhotoCount < 1 || finalPhotoCount > 5) throw new Error('Add between 1 and 5 product photos.');

    if (!supabase) {
      const demoId = input.id ?? crypto.randomUUID();
      const compressedDataUrls = await Promise.all(compressedFiles.map(file => fileToDataUrl(file)));
      const photoUrls = [...compressedDataUrls, ...existingPhotos].slice(0, 5);
      const nextProduct: Product = {
        id: demoId,
        name: input.name.trim(),
        category: input.category,
        grade: input.grade,
        price: input.price,
        unit: input.unit,
        stock: input.stock,
        minOrder: input.minOrder,
        wholesalerId: account.id,
        wholesalerName: account.businessName,
        isActive: input.isActive,
        image: photoUrls[0],
        photos: photoUrls,
      };
      const current = readDemoProducts();
      const updated = currentProduct
        ? current.map((product) => product.id === demoId ? nextProduct : product)
        : [nextProduct, ...current];
      localStorage.setItem(demoProductsKey, JSON.stringify(updated));
      setProducts(updated);
      return;
    }

    const uploadedPaths: string[] = [];
    try {
      for (const file of compressedFiles) {
        const path = `${account.id}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(path, file, { contentType: 'image/jpeg', upsert: false });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
      }

      const photos = [...uploadedPaths, ...existingPhotos].slice(0, 5);
      const productPayload = {
        wholesaler_id: account.id,
        name: input.name.trim(),
        category: input.category,
        grade: input.grade,
        unit: input.unit,
        price: input.price,
        stock: input.stock,
        min_order: input.minOrder,
        is_active: input.isActive,
        photos,
      };
      const writeResult = currentProduct
        ? await supabase.from('products').update(productPayload).eq('id', currentProduct.id).select().single()
        : await supabase.from('products').insert(productPayload).select().single();
      if (writeResult.error) throw writeResult.error;

      const seller = wholesalers.find((entry) => entry.id === account.id);
      const saved = productFromDatabase(writeResult.data, seller);
      const updated = currentProduct
        ? products.map((product) => product.id === saved.id ? saved : product)
        : [saved, ...products];
      setProducts(updated);
      if (currentProduct) {
        const removedPhotos = currentProduct.photos?.filter((photo) => !photos.includes(photo)) ?? [];
        if (removedPhotos.length) {
          const { error: cleanupError } = await supabase.storage.from('product-images').remove(removedPhotos);
          if (cleanupError) throw new Error(`Product was saved, but old image cleanup failed: ${cleanupError.message}`);
        }
      }
    } catch (saveError) {
      if (uploadedPaths.length) {
        const { error: cleanupError } = await supabase.storage.from('product-images').remove(uploadedPaths);
        if (cleanupError) {
          throw new Error(`${saveError instanceof Error ? saveError.message : 'Product save failed.'} Uploaded image cleanup failed: ${cleanupError.message}`);
        }
      }
      throw saveError;
    }
  }, [account, products, wholesalers]);

  const deleteProduct = useCallback(async (product: Product) => {
    if (!account || product.wholesalerId !== account.id) throw new Error('You can only remove your own product listings.');
    if (supabase) {
      const { error: deleteError } = await supabase.from('products').delete().eq('id', product.id);
      if (deleteError) throw deleteError;
      const paths = product.photos?.filter(photo => !photo.startsWith('http')) ?? [];
      if (paths.length) {
        const { error: storageError } = await supabase.storage.from('product-images').remove(paths);
        if (storageError) throw new Error(`Product was deleted, but image cleanup failed: ${storageError.message}`);
      }
    } else {
      const next = readDemoProducts().filter((item) => item.id !== product.id);
      localStorage.setItem(demoProductsKey, JSON.stringify(next));
    }
    setProducts((current) => current.filter((item) => item.id !== product.id));
  }, [account]);

  const toggleProductActive = useCallback(async (product: Product) => {
    if (!account || product.wholesalerId !== account.id) throw new Error('You can only update your own product listings.');
    const nextActive = !product.isActive;
    if (supabase) {
      const { error: updateError } = await supabase.from('products').update({ is_active: nextActive }).eq('id', product.id);
      if (updateError) throw updateError;
    } else {
      const next = readDemoProducts().map((item) => item.id === product.id ? { ...item, isActive: nextActive } : item);
      localStorage.setItem(demoProductsKey, JSON.stringify(next));
    }
    setProducts((current) => current.map((item) => item.id === product.id ? { ...item, isActive: nextActive } : item));
  }, [account]);

  const value = useMemo<CatalogContextValue>(() => ({
    products,
    wholesalers,
    loading,
    error,
    refreshCatalog: loadCatalog,
    saveProduct,
    deleteProduct,
    toggleProductActive,
  }), [products, wholesalers, loading, error, loadCatalog, saveProduct, deleteProduct, toggleProductActive]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') reject(new Error(`Unable to read ${file.name}.`));
      else resolve(reader.result);
    };
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}
