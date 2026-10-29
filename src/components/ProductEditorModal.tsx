import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { categories, grades, units } from '../data/masters';
import { useCatalog } from '../catalog/useCatalog';
import type { Product } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter a product name.'),
  category: z.enum(categories),
  grade: z.enum(grades),
  price: z.coerce.number().positive('Price must be greater than zero.'),
  unit: z.enum(units),
  stock: z.coerce.number().nonnegative('Stock cannot be negative.'),
  minOrder: z.coerce.number().positive('Minimum order must be greater than zero.'),
  isActive: z.boolean(),
}).refine((values) => values.stock === 0 || values.minOrder <= values.stock, {
  path: ['minOrder'],
  message: 'Minimum order cannot exceed available stock.',
});

type FormValues = z.infer<typeof schema>;

type ProductEditorModalProps = {
  open: boolean;
  product: Product | null;
  onClose: () => void;
};

export function ProductEditorModal({ open, product, onClose }: ProductEditorModalProps) {
  const { saveProduct } = useCatalog();
  const [images, setImages] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedPhotos, setSavedPhotos] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      category: 'Rice',
      grade: 'A',
      price: 0,
      unit: 'kg',
      stock: 0,
      minOrder: 1,
      isActive: true,
    },
  });

  useEffect(() => {
    reset(product ? {
      name: product.name,
      category: product.category as (typeof categories)[number],
      grade: product.grade,
      price: product.price,
      unit: product.unit,
      stock: product.stock,
      minOrder: product.minOrder,
      isActive: product.isActive,
    } : {
      name: '',
      category: 'Rice',
      grade: 'A',
      price: 0,
      unit: 'kg',
      stock: 0,
      minOrder: 1,
      isActive: true,
    });
    setSavedPhotos(product?.photos ?? (product?.image ? [product.image] : []));
    setImages([]);
    setError(null);
  }, [product, reset, open]);

  const submit = async (values: FormValues) => {
    setError(null);
    const photoCount = images.length + savedPhotos.length;
    if (photoCount < 1 || photoCount > 5) {
      setError('Add between 1 and 5 product photos. Remove existing photos or choose fewer new ones.');
      return;
    }

    try {
      await saveProduct({
        ...values,
        id: product?.id,
        imageFiles: images,
        existingPhotos: savedPhotos,
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save product.');
    }
  };

  return (
    <Modal
      open={open}
      title={product ? 'Edit product listing' : 'Add a product'}
      description="Keep stock, price, minimum order, and product photos up to date."
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={handleSubmit(submit)}>
        <Input label="Product name" placeholder="e.g. Premium Basmati Rice" {...register('name')} error={errors.name?.message} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Category" options={categories} registration={register('category')} error={errors.category?.message} />
          <SelectField label="Grade" options={grades} registration={register('grade')} error={errors.grade?.message} />
          <Input label="Price" type="number" min="0.01" step="0.01" {...register('price')} error={errors.price?.message} />
          <SelectField label="Unit" options={units} registration={register('unit')} error={errors.unit?.message} />
          <Input label="Available stock" type="number" min="0" step="0.01" {...register('stock')} error={errors.stock?.message} />
          <Input label="Minimum order quantity" type="number" min="0.01" step="0.01" {...register('minOrder')} error={errors.minOrder?.message} />
        </div>
        <div>
          <label htmlFor="product-photos" className="block text-sm font-medium text-slate-700">Product photos (1–5, each compressed under 300 KB)</label>
          <input
            id="product-photos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              setImages((current) => [...current, ...picked].slice(0, Math.max(0, 5 - savedPhotos.length - current.length)));
              event.target.value = '';
            }}
            className="mt-1 block w-full rounded-xl border border-slate-300 p-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:font-semibold file:text-emerald-900"
          />
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
            {savedPhotos.map((photo) => (
              <span key={photo} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                Existing photo
                <button type="button" aria-label="Remove existing photo" onClick={() => setSavedPhotos((current) => current.filter((item) => item !== photo))}>×</button>
              </span>
            ))}
            {images.map((image, index) => (
              <span key={`${image.name}-${image.lastModified}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-900">
                {image.name}
                <button type="button" aria-label={`Remove ${image.name}`} onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>
              </span>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" {...register('isActive')} />
          Active and visible in retailer catalogue
        </label>
        {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save listing'}</Button>
        </div>
      </form>
    </Modal>
  );
}

type SelectRegistration = ReturnType<ReturnType<typeof useForm<FormValues>>['register']>;

function SelectField({
  label,
  options,
  registration,
  error,
}: {
  label: string;
  options: readonly string[];
  registration: SelectRegistration;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label}
        <select {...registration} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-500">
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      {error ? <p role="alert" className="mt-1 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
