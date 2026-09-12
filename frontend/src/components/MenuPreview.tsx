import React, { useState } from 'react';

const categories = ['Todos', 'Entradas', 'Fondos', 'Bebidas'];

export default function MenuPreview({ menuItems, onBack, onEditMenu }) {
  const [activeCategory, setActiveCategory] = useState('Todos');

  const filteredMenu = activeCategory === 'Todos'
    ? menuItems
    : menuItems.filter(item => item.category === activeCategory);

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      {/* Cabecera con botones */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Vista Previa del Menú</h2>
            <p className="text-sm text-slate-500">Estos son los platos de tu carta.</p>
          </div>
        </div>

        <button
          onClick={onEditMenu}
          className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
          Editar menú
        </button>
      </div>

      {/* Filtro de Categorías */}
      <div className="flex gap-3 mb-8 overflow-x-auto no-scrollbar pb-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
              activeCategory === cat
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid de Platos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {filteredMenu.map(item => (
          <div key={item.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
            {/* Imagen del plato */}
            <div className="h-48 w-full overflow-hidden bg-slate-100">
              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
            </div>

            {/* Contenido */}
            <div className="p-5 flex flex-col flex-1">
              <div className="flex justify-between items-start mb-2 gap-4">
                <h3 className="font-bold text-lg text-slate-900 leading-tight">{item.name}</h3>
                <span className="font-black text-indigo-600">${item.price}</span>
              </div>
              <p className="text-sm text-slate-500 line-clamp-3 mb-4">
                {item.description}
              </p>
              {/* Categoría Badge */}
              <div className="mt-auto pt-4 border-t border-slate-100">
                <span className="inline-block bg-slate-100 text-slate-500 text-xs font-semibold px-2.5 py-1 rounded-md">
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