// src/data/db-local.js
// ── VERSIÓN ACTUALIZADA CON MULTISUCURSAL ──
import Dexie from 'dexie';

export const db = new Dexie('PuntoVentaDB');

// ── VERSIÓN 5: agrega branch_id a products y sales ──────────────
db.version(5).stores({
    products: 'id, sku, name, category, business_id, branch_id',
    sales:    '++id, date, sync_status, business_id, branch_id',
    settings: 'id'
});

// ── VERSIÓN 6: fuerza reapertura limpia si hay conflicto de esquema ──
db.version(6).stores({
    products: 'id, sku, name, category, business_id, branch_id',
    sales:    '++id, date, sync_status, business_id, branch_id',
    settings: 'id'
});

db.on('populate', () => {
    console.log("Base de datos creada/actualizada a versión 6 (multisucursal).");
});

export async function isDbEmpty() {
    const count = await db.products.count();
    return count === 0;
}

export async function seedDummyData() {
    const count = await db.products.count();
    if (count > 0) return;

    await db.products.bulkAdd([
        { id: crypto.randomUUID(), name: "Cemento Gris 50kg", sku: "CEM-50",  price: 280.00, category: "construccion", stock: 100, business_id: "demo", branch_id: null, img: "https://via.placeholder.com/150" },
        { id: crypto.randomUUID(), name: "Martillo Uña Curva", sku: "HER-MAR", price: 120.00, category: "herramientas", stock: 15,  business_id: "demo", branch_id: null, img: "https://via.placeholder.com/150" },
        { id: crypto.randomUUID(), name: "Tubo PVC 2in",        sku: "PLO-PVC", price: 35.00,  category: "plomeria",    stock: 50,  business_id: "demo", branch_id: null, img: "https://via.placeholder.com/150" },
    ]);
}