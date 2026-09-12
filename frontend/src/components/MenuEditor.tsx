import React, { useState } from 'react';

export default function MenuEditor({ menuItems, setMenuItems, onBack, onNotify }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estado para el formulario
  const [formData, setFormData] = useState({
    id: null, // null = creando, número = editando
    name: '',
    price: '',
    category: '',
    description: ''
  });

  // Función para manejar cambios en los inputs
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleEditClick = (item) => {
    // Llenamos el formulario con los datos del plato seleccionado
    setFormData({
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
      description: item.description || ''
    });
    setIsModalOpen(true);
  };

  const handleSaveDish = () => {
    if (!formData.name || !formData.price || !formData.category) {
      alert("Por favor completa el nombre, precio y categoría.");
      return;
    }

    if (formData.id) {
      // MODO EDICIÓN: Actualizamos el plato existente
      const updatedMenu = menuItems.map(item => {
        if (item.id === formData.id) {
          return {
            ...item,
            name: formData.name,
            price: parseFloat(formData.price).toFixed(2),
            category: formData.category,
            description: formData.description
          };
        }
        return item;
      });
      setMenuItems(updatedMenu);
      onNotify('Plato actualizado', `Los cambios en "${formData.name}" han sido guardados.`);
    } else {
      // MODO CREACIÓN: Insertamos un plato nuevo
      const newDish = {
        id: Date.now(),
        name: formData.name,
        price: parseFloat(formData.price).toFixed(2),
        category: formData.category,
        description: formData.description,
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
        status: 'Activo'
      };
      setMenuItems([newDish, ...menuItems]);
      onNotify('Nuevo plato añadido', `El plato "${formData.name}" se publicó en tu carta digital.`);
    }

    // Cerrar modal y limpiar formulario
    setIsModalOpen(false);
    setFormData({ id: null, name: '', price: '', category: '', description: '' });
  };

  // Función para eliminar un plato dinámicamente
  const handleDelete = (id) => {
    setMenuItems(menuItems.filter(item => item.id !== id));
  };

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Gestión de Carta</h2>
            <p className="text-sm text-slate-500">Añade, edita o elimina platos de tu menú.</p>
          </div>
        </div>

        <button
          onClick={() => {
            setFormData({ id: null, name: '', price: '', category: '', description: '' });
            setIsModalOpen(true);
          }}
          className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          Añadir Plato
        </button>
      </div>

      {/* Tabla de Platos */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-medium">Nombre del Plato</th>
                <th className="px-6 py-4 font-medium">Categoría</th>
                <th className="px-6 py-4 font-medium">Precio</th>
                <th className="px-6 py-4 font-medium">Estado</th>
                <th className="px-6 py-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {menuItems.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900">{item.name}</td>
                  <td className="px-6 py-4 text-slate-600">
                    <span className="bg-slate-100 px-2.5 py-1 rounded-md text-xs font-semibold">{item.category}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-900 font-medium">${item.price}</td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleEditClick(item)}
                      className="text-indigo-600 hover:text-indigo-800 font-medium text-sm mr-3 transition-colors"
                    >Editar</button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700 font-medium text-sm">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Formulario */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden animate-[scaleUp_0.2s_ease-out] flex flex-col max-h-[90vh]">

            {/* Header Modal */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="text-lg font-bold text-slate-900">
                {formData.id ? 'Editar Plato' : 'Nuevo Plato'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            {/* Body Modal (Scrollable) */}
            <div className="p-6 overflow-y-auto no-scrollbar space-y-5">

              {/* Foto */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Imagen del plato</label>
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer">
                  <svg className="w-8 h-8 text-slate-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  <span className="text-sm text-indigo-600 font-medium">Sube una imagen</span> o arrastra y suelta
                </div>
              </div>

              {/* Nombre y Precio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Ej. Lomo Saltado"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Precio ($)</label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Categoría</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-white"
                >
                  <option value="">Selecciona una categoría</option>
                  <option value="Entradas">Entradas</option>
                  <option value="Fondos">Fondos</option>
                  <option value="Postres">Postres</option>
                  <option value="Bebidas">Bebidas</option>
                </select>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción corta</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Ingredientes principales o descripción atractiva..."
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none"
                ></textarea>
              </div>

            </div>

            {/* Footer Modal */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSaveDish}
                className="px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
              >
                Guardar Plato
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}