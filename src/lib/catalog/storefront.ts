export const SEARCH_PRODUCT_THRESHOLD = 12;
export const STICKY_CATEGORY_THRESHOLD = 8;
export const PRODUCTS_PER_PAGE = 20;

export function shouldShowCatalogSearch(totalProducts: number) {
  return totalProducts > SEARCH_PRODUCT_THRESHOLD;
}

export function shouldShowCategoryNavigation(categoryCount: number) {
  return categoryCount > 1;
}

export function shouldUseStickyCategories(categoryCount: number, totalProducts: number) {
  return (
    categoryCount > STICKY_CATEGORY_THRESHOLD ||
    totalProducts > SEARCH_PRODUCT_THRESHOLD
  );
}

export function createMapSearchUrl(address: string | null) {
  const normalizedAddress = address?.trim();
  if (!normalizedAddress) return null;

  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", normalizedAddress);
  return url.toString();
}
