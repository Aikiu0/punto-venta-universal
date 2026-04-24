// src/data/db-local.js
import Dexie from 'dexie';

export const db = new Dexie('PuntoVentaDB');

db.version(5).stores({
  products: 'id, sku, name, category, business_id, branch_id',
  sales:    '++id, date, sync_status, business_id, branch_id',
  settings: 'id'
});

// CAMBIO CRÍTICO: Subimos a versión 4 para aplicar la corrección de 'settings'
db.version(4).stores({
  // products: ID texto (UUID) para compatibilidad con Supabase
  products: 'id, sku, name, category, business_id', 
  
  // sales: ID autoincremental (++id) para ventas locales temporales
  sales: '++id, date, sync_status, business_id',      
  
  // CORRECCIÓN AQUÍ:
  // Cambiamos 'key' por 'id' para que coincida con el objeto { id: 1 } que enviamos
  settings: 'id'                        
});

// Limpieza de seguridad al actualizar versión
db.on('populate', () => {
    console.log("Base de datos creada/actualizada.");
});

export async function isDbEmpty() {
  const count = await db.products.count();
  return count === 0;
}

export async function seedDummyData() {
    const count = await db.products.count();
    if (count > 0) return;

    await db.products.bulkAdd([
        { id: crypto.randomUUID(), name: "Cemento Gris 50kg", sku: "CEM-50", price: 280.00, category: "construccion", stock: 100, business_id: "demo", img: "https://via.placeholder.com/150" },
        { id: crypto.randomUUID(), name: "Martillo Uña Curva", sku: "HER-MAR", price: 120.00, category: "herramientas", stock: 15, business_id: "demo", img: "https://via.placeholder.com/150" },
        { id: crypto.randomUUID(), name: "Tubo PVC 2in", sku: "PLO-PVC", price: 35.00, category: "plomeria", stock: 50, business_id: "demo", img: "https://via.placeholder.com/150" },
    ]);
}