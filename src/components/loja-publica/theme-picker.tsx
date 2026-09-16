"use client";

import { Check } from "lucide-react";
import { useId } from "react";

import { THEMES } from "@/lib/design-system/themes";
import { cn } from "@/lib/utils/cn";
import type { TenantTheme } from "@/types/database";

export type ThemePickerProps = {
  className?: string;
  onValueChange: (theme: TenantTheme) => void;
  value: TenantTheme;
};

export function ThemePicker({ className, onValueChange, value }: ThemePickerProps) {
  const groupName = useId();

  return (
    <fieldset
      className={cn("grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3", className)}
    >
      <legend className="sr-only">Escolha o tema da loja</legend>
      {THEMES.map((theme) => {
        const selected = value === theme.id;

        return (
          <label className="group cursor-pointer" key={theme.id}>
            <input
              checked={selected}
              className="peer sr-only"
              name={groupName}
              onChange={() => onValueChange(theme.id)}
              type="radio"
              value={theme.id}
            />
            <span
              className={cn(
                "block min-h-11 rounded-[var(--radius-card)] border bg-white p-2 text-left transition-[border-color,box-shadow,transform] group-hover:-translate-y-0.5 group-hover:border-brand-500 peer-focus-visible:ring-3 peer-focus-visible:ring-brand-200",
                selected && "border-2 border-brand-600 p-[7px] shadow-[var(--shadow-elevation)]",
              )}
            >
              <span
                className="flex h-14 items-end gap-2 overflow-hidden rounded-lg border border-[var(--cor-borda)] bg-[var(--cor-fundo)] p-2 sm:h-16"
                data-tema={theme.id}
              >
                <span className="h-8 flex-1 rounded-md bg-[var(--cor-superficie)] shadow-sm" />
                <span className="h-6 w-7 rounded-md bg-[var(--cor-acao)]" />
              </span>
              <span className="block px-1 pb-1 pt-2">
                <span className="flex items-center justify-between gap-2 text-sm font-semibold text-[var(--app-foreground)]">
                  {theme.name}
                  {selected ? (
                    <span className="grid size-5 place-items-center rounded-full bg-brand-700 text-white">
                      <Check aria-hidden="true" className="size-3" strokeWidth={3} />
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 hidden text-xs leading-4 text-[var(--app-foreground-muted)] md:block">
                  {theme.description}
                </span>
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
