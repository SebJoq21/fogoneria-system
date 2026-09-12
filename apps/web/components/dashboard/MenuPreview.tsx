"use client";

import { useState } from "react";
import Image from "next/image";
import type { MenuItem } from "@/lib/dashboard";

export function MenuPreview({
  menuItems,
}: {
  menuItems: MenuItem[];
  onEditMenu?: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState("Todos");
  const categories = ["Todos", ...Array.from(new Set(menuItems.map((i) => i.category)))];
  const filtered =
    activeCategory === "Todos"
      ? menuItems
      : menuItems.filter((i) => i.category === activeCategory);

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-5 h-10 rounded-full text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
              activeCategory === cat
                ? "bg-primary text-white"
                : "bg-surface text-ink-600 border border-ink-900/15 hover:border-ink-900"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {filtered.map((item) => (
          <div key={item.id} className="bg-surface rounded-2xl border border-ink-900/10 overflow-hidden flex flex-col">
            <div className="relative h-48 w-full bg-primary/[0.04]">
              <Image src={item.image} alt={item.name} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
            </div>
            <div className="p-4 flex flex-col flex-1">
              <div className="flex justify-between items-start mb-2 gap-4">
                <h3 className="font-medium text-sm text-ink-900 leading-tight">{item.name}</h3>
                <span className="font-medium text-sm text-ink-900">${item.price}</span>
              </div>
              <p className="text-nav text-ink-600 line-clamp-3 mb-4">{item.description}</p>
              <div className="mt-auto pt-3 border-t border-ink-900/[0.06]">
                <span className="inline-block bg-primary/[0.05] text-ink-600 text-xs font-medium px-2.5 py-1 rounded-md">
                  {item.category}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
