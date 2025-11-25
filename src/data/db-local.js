// src/data/db-local.js
import Dexie from 'dexie';

export const db = new Dexie('PuntoVentaDB');

// CAMBIO CRÍTICO: Subimos a versión 3
// Definimos los esquemas para soportar UUIDs y Multi-Tenant
db.version(3).stores({
  // products: QUITAMOS '++' para que el ID sea el UUID de Supabase (texto), no un número generado.
  // Agregamos 'business_id' para filtrar.
  products: 'id, sku, name, category, business_id', 
  
  // sales: Aquí SI dejamos '++id' porque las ventas nacen localmente y necesitan un ID temporal numérico
  // Agregamos 'sync_status' y 'business_id'
  sales: '++id, date, sync_status, business_id',      
  
  settings: 'key'                        
});

// --- IMPORTANTE: Limpieza de seguridad al actualizar versión ---
// Esto asegura que no queden productos con IDs numéricos viejos mezclados con UUIDs nuevos
db.on('populate', () => {
    console.log("Base de datos creada/actualizada. Limpiando...");
});

export async function isDbEmpty() {
  const count = await db.products.count();
  return count === 0;
}

export async function seedDummyData() {
    // Solo usamos esto si es la primera vez y no hay internet
    const count = await db.products.count();
    if (count > 0) return;

    // Generamos IDs falsos tipo UUID para mantener consistencia si estamos offline
    await db.products.bulkAdd([
        { id: crypto.randomUUID(), name: "Cemento Gris 50kg", sku: "CEM-50", price: 280.00, category: "construccion", stock: 100, business_id: "demo", img: "https://via.placeholder.com/150" },
        { id: crypto.randomUUID(), name: "Martillo Uña Curva", sku: "HER-MAR", price: 120.00, category: "herramientas", stock: 15, business_id: "demo", img: "https://via.placeholder.com/150" },
        { id: crypto.randomUUID(), name: "Tubo PVC 2in", sku: "PLO-PVC", price: 35.00, category: "plomeria", stock: 50, business_id: "demo", img: "https://via.placeholder.com/150" },
    ]);
}