"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CatalogCategory } from "@/types/catalog";
import { cn } from "@/lib/utils/cn";

export type CategoryNavProps = {
  categories: Pick<CatalogCategory, "id" | "nome">[];
  highlightSelection?: boolean;
  targetIdPrefix: string;
  sticky?: boolean;
};

export function CategoryNav({ categories, highlightSelection = true, sticky = false, targetIdPrefix }: CategoryNavProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(categories[0]?.id ?? null);
  const [edgeFade, setEdgeFade] = useState({ end: false, start: false });
  const activeId = highlightSelection
    ? categories.some((category) => category.id === selectedId)
      ? selectedId
      : categories[0]?.id
    : null;

  const updateEdgeFade = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const next = {
      end: scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1,
      start: scroller.scrollLeft > 1,
    };
    setEdgeFade((current) =>
      current.end === next.end && current.start === next.start ? current : next,
    );
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(updateEdgeFade);
    const scroller = scrollerRef.current;
    const observer = new ResizeObserver(updateEdgeFade);
    if (scroller) observer.observe(scroller);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [categories, updateEdgeFade]);

  if (categories.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Categorias de produtos"
      className={cn(
        "relative [border-bottom:1px_solid_color-mix(in_srgb,var(--cor-borda)_55%,transparent)]",
        sticky && "sticky top-0 z-30 bg-[color-mix(in_srgb,var(--cor-fundo)_94%,transparent)] shadow-[0_6px_18px_rgb(0_0_0_/_5%)] backdrop-blur",
      )}
    >
      <div className="relative mx-auto w-full max-w-[var(--content-width)]">
        {edgeFade.start ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-[linear-gradient(to_right,var(--cor-fundo),transparent)]"
          />
        ) : null}
        <div
          className="flex w-full gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] @2xl/store:px-6 @5xl/store:px-8 [&::-webkit-scrollbar]:hidden"
          onScroll={updateEdgeFade}
          ref={scrollerRef}
        >
          {categories.map((category) => {
            const active = category.id === activeId;
            const targetId = `${targetIdPrefix}-${category.id}`;

            return (
              <a
                aria-current={active ? "true" : undefined}
                className={
                  active
                    ? "inline-flex min-h-11 shrink-0 items-center rounded-full border border-[var(--cor-acao)] bg-[var(--cor-acao)] px-4 py-2 text-sm font-semibold text-[var(--cor-na-acao)] shadow-sm outline-none transition-[opacity,transform,box-shadow] hover:-translate-y-px hover:opacity-95 focus-visible:ring-3 focus-visible:ring-[color:var(--cor-acao)]/30"
                    : "inline-flex min-h-11 shrink-0 items-center rounded-full border border-[var(--cor-borda)] bg-[var(--cor-superficie)] px-4 py-2 text-sm font-medium text-[var(--cor-texto-suave)] shadow-[0_1px_2px_color-mix(in_srgb,var(--cor-primaria)_8%,transparent)] outline-none transition-[border-color,color,background-color,transform] hover:-translate-y-px hover:border-[var(--cor-primaria)] hover:bg-[color-mix(in_srgb,var(--cor-superficie)_92%,var(--cor-acao))] hover:text-[var(--cor-texto)] focus-visible:ring-3 focus-visible:ring-[color:var(--cor-primaria)]/30"
                }
                href={`#${targetId}`}
                key={category.id}
                onClick={(event) => {
                  setSelectedId(category.id);
                  const scroller = scrollerRef.current;
                  if (scroller) {
                    const link = event.currentTarget;
                    scroller.scrollTo({
                      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                      left: link.offsetLeft - (scroller.clientWidth - link.clientWidth) / 2,
                    });
                  }
                  const target = document.getElementById(targetId);
                  if (!target) return;

                  event.preventDefault();
                  target.scrollIntoView({
                    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                    block: "start",
                  });
                }}
              >
                {category.nome}
              </a>
            );
          })}
        </div>
        {edgeFade.end ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-[linear-gradient(to_left,var(--cor-fundo),transparent)]"
          />
        ) : null}
      </div>
    </nav>
  );
}
