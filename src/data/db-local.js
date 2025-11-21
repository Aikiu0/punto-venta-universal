// src/data/db-local.js
import Dexie from 'dexie';

export const db = new Dexie('PuntoVentaDB');

// CAMBIO AQUÍ: Subimos a versión 2
db.version(2).stores({
  products: '++id, sku, name, category', 
  sales: '++id, date, sync_status',      
  settings: 'key'                        
});

// ... (el resto del archivo sigue igual)
export async function isDbEmpty() {
  const count = await db.products.count();
  return count === 0;
}

export async function seedDummyData() {
    // ... (tu código de seedDummyData igual)
    // Asegúrate de que este bloque esté aquí
    await db.products.clear(); // Limpiamos antes de agregar para evitar duplicados al subir versión
    await db.products.bulkAdd([
        { name: "Cemento Gris 50kg", sku: "CEM-50", price: 280.00, category: "construccion", stock: 100, img: "https://via.placeholder.com/150" },
        { name: "Martillo Uña Curva", sku: "HER-MAR", price: 120.00, category: "herramientas", stock: 15, img: "https://via.placeholder.com/150" },
        { name: "Tubo PVC 2in", sku: "PLO-PVC", price: 35.00, category: "plomeria", stock: 50, img: "https://via.placeholder.com/150" },
        { name: "Cable Calibre 12", sku: "ELE-12", price: 18.00, category: "electricidad", stock: 200, img: "https://via.placeholder.com/150" },
        { name: "Llave Stilson", sku: "HER-STI", price: 450.00, category: "herramientas", stock: 5, img: "https://via.placeholder.com/150" }
    ]);
}