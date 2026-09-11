import { ProductCard } from "@/components/loja-publica/product-card";
import type { CatalogProduct } from "@/types/catalog";

export type ProductGridProps = {
  analyticsSlug?: string;
  cartQuantities?: Record<string, number>;
  onAdd?: (product: CatalogProduct) => void;
  onDecrement?: (productId: string) => void;
  products: CatalogProduct[];
  storeName: string;
  whatsapp: string;
};

export function ProductGrid({ analyticsSlug, cartQuantities, onAdd, onDecrement, products, storeName, whatsapp }: ProductGridProps) {
  return (
    <div className="@container/product-grid mx-auto w-full max-w-[80rem]">
      <div className="grid w-full grid-cols-2 items-stretch gap-3 @sm/product-grid:grid-cols-3 @xl/product-grid:grid-cols-4 @2xl/product-grid:gap-4 @7xl/product-grid:grid-cols-5">
        {products.map((product) => (
          <ProductCard
            analyticsSlug={analyticsSlug}
            cartQuantity={cartQuantities?.[product.id] ?? 0}
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
