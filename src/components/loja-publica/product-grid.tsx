import { ProductCard } from "@/components/loja-publica/product-card";
import type { CatalogProduct } from "@/types/catalog";

export type ProductGridProps = {
  analyticsSlug?: string;
  cartQuantities?: Record<string, number>;
  onAdd?: (product: CatalogProduct) => void;
  onDecrement?: (productId: string) => void;
  prioritizeFirstImage?: boolean;
  products: CatalogProduct[];
  storeName: string;
  whatsapp: string;
};

export function ProductGrid({ analyticsSlug, cartQuantities, onAdd, onDecrement, prioritizeFirstImage = false, products, storeName, whatsapp }: ProductGridProps) {
  return (
    <div className="@container/product-grid w-full">
      <div className="grid w-full grid-cols-2 items-stretch gap-3 @2xl/product-grid:grid-cols-3 @2xl/product-grid:gap-4 @5xl/product-grid:grid-cols-4">
        {products.map((product, index) => (
          <ProductCard
            analyticsSlug={analyticsSlug}
            cartQuantity={cartQuantities?.[product.id] ?? 0}
            eagerImage={prioritizeFirstImage && index === 0}
            key={product.id}
            onAdd={onAdd}
            onDecrement={onDecrement}
            product={product}
            storeName={storeName}
            whatsapp={whatsapp}
          />
        ))}
      </div>
    </div>
  );
}
