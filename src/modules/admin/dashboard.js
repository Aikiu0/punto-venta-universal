// src/modules/admin/dashboard.js
import { supabase } from '../../data/supabase.js';
import { ThemeService } from '../../services/theme.js';
import { db } from '../../data/db-local.js';
import { syncService } from '../../services/sync.js';
import { PermissionService } from '../../services/permissions.js';
import { renderSidebarHeader } from './components/sidebarHeader.js';

let salesChartInstance = null;
const activeAnimations = {};

const icon = (name) => {
    const icons = {
        dashboard: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13.2c0-.75.42-1.43 1.08-1.79l6.5-3.55a2 2 0 0 1 1.84 0l6.5 3.55A2.04 2.04 0 0 1 20 13.2V19a2 2 0 0 1-2 2h-3.25a.75.75 0 0 1-.75-.75V16a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v4.25a.75.75 0 0 1-.75.75H6a2 2 0 0 1-2-2z" fill="currentColor"/></svg>`,
        orders: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.75A2.75 2.75 0 0 1 9.75 2h4.5A2.75 2.75 0 0 1 17 4.75V6h1.25A2.75 2.75 0 0 1 21 8.75v8.5A2.75 2.75 0 0 1 18.25 20H5.75A2.75 2.75 0 0 1 3 17.25v-8.5A2.75 2.75 0 0 1 5.75 6H7zm1.5 0V6h7V4.75c0-.69-.56-1.25-1.25-1.25h-4.5c-.69 0-1.25.56-1.25 1.25" fill="currentColor"/></svg>`,
        inventory: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.75A2.75 2.75 0 0 1 6.75 5h10.5A2.75 2.75 0 0 1 20 7.75v8.5A2.75 2.75 0 0 1 17.25 19H6.75A2.75 2.75 0 0 1 4 16.25zm4.75 1.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5zm0 4a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5z" fill="currentColor"/></svg>`,
        pos: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.75 3h10.5A2.75 2.75 0 0 1 20 5.75v12.5A2.75 2.75 0 0 1 17.25 21H6.75A2.75 2.75 0 0 1 4 18.25V5.75A2.75 2.75 0 0 1 6.75 3M8 7.25c0 .41.34.75.75.75h6.5a.75.75 0 0 0 0-1.5h-6.5A.75.75 0 0 0 8 7.25m.75 3.75A.75.75 0 0 0 8 11.75v4.5c0 .41.34.75.75.75h6.5c.41 0 .75-.34.75-.75v-4.5a.75.75 0 0 0-.75-.75z" fill="currentColor"/></svg>`,
        suppliers: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.75A2.75 2.75 0 0 1 6.75 6h10.5A2.75 2.75 0 0 1 20 8.75v6.5A2.75 2.75 0 0 1 17.25 18H6.75A2.75 2.75 0 0 1 4 15.25zm4.75.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5m-1 3.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5z" fill="currentColor"/></svg>`,
        history: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 1-8.95 10h1.53A7.5 7.5 0 1 0 12 4.5c-1.93 0-3.69.73-5.02 1.93L9.5 9H3V2.5l2.9 2.9A8.96 8.96 0 0 1 12 3m-.75 4.25c0-.41.34-.75.75-.75s.75.34.75.75v4.19l2.47 1.42a.75.75 0 0 1-.74 1.3l-2.85-1.63a1.5 1.5 0 0 1-.88-1.3z" fill="currentColor"/></svg>`,
        settings: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10.34 2.78 1.66-.96 1.66.96.45 1.84a7.92 7.92 0 0 1 1.47.86l1.82-.56 1.66.96v1.92l-1.37 1.3c.05.3.08.6.08.9s-.03.6-.08.9l1.37 1.3v1.92l-1.66.96-1.82-.56c-.46.35-.96.64-1.47.86l-.45 1.84-1.66.96-1.66-.96-.45-1.84a7.92 7.92 0 0 1-1.47-.86l-1.82.56-1.66-.96v-1.92l1.37-1.3A5.7 5.7 0 0 1 6.2 12c0-.3.03-.6.08-.9L4.9 9.8V7.88l1.66-.96 1.82.56c.46-.35.96-.64 1.47-.86zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6" fill="currentColor"/></svg>`,
        logout: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.75 3a.75.75 0 0 1 0 1.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h3.75a.75.75 0 0 1 0 1.5H7A4 4 0 0 1 3 17V7a4 4 0 0 1 4-4zm5.72 4.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 1 1-1.06-1.06l2.97-2.97H9.75a.75.75 0 0 1 0-1.5h9.69l-2.97-2.97a.75.75 0 0 1 0-1.06" fill="currentColor"/></svg>`,
        theme: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.25a.75.75 0 0 1 .75.75v1.25a.75.75 0 0 1-1.5 0V4a.75.75 0 0 1 .75-.75M6.52 5.47a.75.75 0 0 1 1.06 0l.88.88A.75.75 0 1 1 7.4 7.41l-.88-.88a.75.75 0 0 1 0-1.06m10.9 0a.75.75 0 0 1 0 1.06l-.88.88a.75.75 0 0 1-1.06-1.06l.88-.88a.75.75 0 0 1 1.06 0M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10m-8 4.25h1.25a.75.75 0 0 1 0 1.5H4a.75.75 0 0 1 0-1.5m14.75 0H20a.75.75 0 0 1 0 1.5h-1.25a.75.75 0 0 1 0-1.5M7.4 16.59a.75.75 0 0 1 1.06 1.06l-.88.88a.75.75 0 0 1-1.06-1.06zm9.2 0 .88.88a.75.75 0 0 1-1.06 1.06l-.88-.88a.75.75 0 1 1 1.06-1.06M12 18.75a.75.75 0 0 1 .75.75v1.25a.75.75 0 0 1-1.5 0V19.5a.75.75 0 0 1 .75-.75" fill="currentColor"/></svg>`,
        sales: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18.5A2.5 2.5 0 0 1 3.5 16V8A2.5 2.5 0 0 1 6 5.5h12A2.5 2.5 0 0 1 20.5 8v8a2.5 2.5 0 0 1-2.5 2.5zm0-11.5a1 1 0 0 0-1 1v.25h14V8a1 1 0 0 0-1-1zm-1 3v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6z" fill="currentColor"/></svg>`,
        profit: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c.41 0 .75.34.75.75v.96c1.98.24 3.5 1.64 3.5 3.54a.75.75 0 0 1-1.5 0c0-1.14-1.11-2.05-2.75-2.05s-2.75.91-2.75 2.05c0 1 .83 1.48 2.98 1.94 1.95.42 4.27 1 4.27 3.56 0 1.94-1.57 3.36-3.75 3.58v.92a.75.75 0 0 1-1.5 0v-.92c-2.18-.22-3.75-1.64-3.75-3.58a.75.75 0 0 1 1.5 0c0 1.14 1.11 2.05 3 2.05s3-.91 3-2.05c0-1.12-.94-1.57-3.09-2.03C8.96 12.5 7.75 11.72 7.75 9.25c0-1.9 1.52-3.3 3.5-3.54v-.96c0-.41.34-.75.75-.75" fill="currentColor"/></svg>`,
        month: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.75 3a.75.75 0 0 1 .75.75V5h7V3.75a.75.75 0 0 1 1.5 0V5h.25A2.75 2.75 0 0 1 20 7.75v9.5A2.75 2.75 0 0 1 17.25 20H6.75A2.75 2.75 0 0 1 4 17.25v-9.5A2.75 2.75 0 0 1 6.75 5H7V3.75A.75.75 0 0 1 7.75 3m-2.25 6v8.25c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25V9z" fill="currentColor"/></svg>`,
        avg: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5 4.5 8.25 12 12l7.5-3.75zm-6 5.1v4.65L12 18l6-3.75V9.6L12.34 12.4a.75.75 0 0 1-.68 0z" fill="currentColor"/></svg>`,
        alert: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.75 2.84 19.5c-.38.66.09 1.5.84 1.5h16.64c.75 0 1.22-.84.84-1.5zM12 9c.41 0 .75.34.75.75v4.5a.75.75 0 0 1-1.5 0v-4.5c0-.41.34-.75.75-.75m0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2" fill="currentColor"/></svg>`,
        trend: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16.25 10.25 11l3 3L19 8.25V12a.75.75 0 0 0 1.5 0V6.5A1.5 1.5 0 0 0 19 5h-5.5a.75.75 0 0 0 0 1.5h3.69l-4.94 4.94-3-3a1 1 0 0 0-1.41 0L3.94 15.2A.75.75 0 1 0 5 16.25" fill="currentColor"/></svg>`,
        products: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.75 4 7v10l8 4.25L20 17V7zm0 1.7 6.15 3.27L12 11 5.85 7.72zM5.5 9.03l5.75 3.05v7.16L5.5 16.2zm7.25 10.21v-7.16l5.75-3.05v7.17z" fill="currentColor"/></svg>`,
        chart: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.75 19A2.75 2.75 0 0 1 3 16.25v-8.5A2.75 2.75 0 0 1 5.75 5h12.5A2.75 2.75 0 0 1 21 7.75v8.5A2.75 2.75 0 0 1 18.25 19zm-.25-2.75c0 .69.56 1.25 1.25 1.25h11.5c.69 0 1.25-.56 1.25-1.25v-7.5H5.5zm2.6-1.1a.75.75 0 0 1-.53-1.28l2.53-2.53a.75.75 0 0 1 .98-.08l1.89 1.42 2.91-3.4a.75.75 0 1 1 1.14.97l-3.38 3.96a.75.75 0 0 1-1.02.1l-1.93-1.45-2.07 2.07a.75.75 0 0 1-.52.22" fill="currentColor"/></svg>`,
        debt: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a8 8 0 1 0 8 8 .75.75 0 0 1 1.5 0 9.5 9.5 0 1 1-2.78-6.72.75.75 0 1 1-1.06 1.06A7.95 7.95 0 0 0 12 4m.75 3.25a.75.75 0 0 0-1.5 0v5c0 .2.08.39.22.53l3.25 3.25a.75.75 0 0 0 1.06-1.06l-3.03-3.03z" fill="currentColor"/></svg>`,
        slow: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5A8.5 8.5 0 1 0 20.5 12 .75.75 0 0 1 22 12 10 10 0 1 1 12 2a.75.75 0 0 1 0 1.5m.75 3.75a.75.75 0 0 0-1.5 0v5.06c0 .2.08.39.22.53l2.75 2.75a.75.75 0 1 0 1.06-1.06l-2.53-2.53z" fill="currentColor"/></svg>`,
        stock: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.75 4 7v10l8 4.25L20 17V7zm0 1.7 6.15 3.27L12 11 5.85 7.72zm-6.5 4.58 5.75 3.05v7.16L5.5 16.2zm7.25 10.21v-7.16l5.75-3.05v7.17z" fill="currentColor"/></svg>`,
        empty: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.75 4h10.5A2.75 2.75 0 0 1 20 6.75v10.5A2.75 2.75 0 0 1 17.25 20H6.75A2.75 2.75 0 0 1 4 17.25V6.75A2.75 2.75 0 0 1 6.75 4m1 4.25a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5zm0 4a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5z" fill="currentColor"/></svg>`
    };
    return icons[name] || '';
};

// ── Utils ──────────────────────────────────────────────────────
function animateValue(id, start, end, duration, isCurrency = true) {
    const obj = document.getElementById(id);
    if (!obj) return;
    if (activeAnimations[id]) cancelAnimationFrame(activeAnimations[id]);
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        obj.innerHTML = isCurrency
            ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(progress === 1 ? end : value)
            : value;
        if (progress < 1) activeAnimations[id] = window.requestAnimationFrame(step);
        else delete activeAnimations[id];
    };
    activeAnimations[id] = window.requestAnimationFrame(step);
}

const fmt    = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
const fmtNum = (n) => Number(n || 0).toLocaleString('es-MX');

function getSaludo() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
}
function getDayName() {
    return new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ── Render ─────────────────────────────────────────────────────
export function renderDashboard() {
    const lockHistory  = PermissionService.can('history')   ? '' : '🔒 ';
    const lockOrders   = PermissionService.can('web_orders') ? '' : '🔒 ';
    const lockSettings = PermissionService.can('settings')  ? '' : '🔒 ';
    const lockSuppliers= PermissionService.can('suppliers') ? '' : '🔒 ';
    const hasHistoryAccess = PermissionService.can('history');
    const chartBlurClass   = hasHistoryAccess ? '' : 'premium-blur-content';
    const chartOverlay     = hasHistoryAccess ? '' : `
        <div class="premium-lock-overlay" onclick="window.checkPlan(event,'history')">
            <div class="lock-badge">🔒</div>
            <div class="lock-text">Ver Análisis de Ventas</div>
        </div>`;

    return `
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .dashboard-shell {
            --dash-bg: #08111f;
            --dash-surface: #0f1b2d;
            --dash-surface-soft: #13233a;
            --dash-surface-elevated: #162942;
            --dash-border: rgba(148, 163, 184, 0.16);
            --dash-border-strong: rgba(148, 163, 184, 0.24);
            --dash-text: #e5eefc;
            --dash-text-muted: #90a2bf;
            --dash-text-soft: #6f839f;
            --dash-brand: #7c6cf2;
            --dash-brand-soft: rgba(124, 108, 242, 0.14);
            --dash-success: #24b47e;
            --dash-warning: #d5a447;
            --dash-danger: #e46c75;
            --dash-shadow: 0 20px 45px rgba(2, 6, 23, 0.32);
            --dash-radius-lg: 24px;
            --dash-radius-md: 18px;
            --dash-radius-sm: 14px;
            font-family: 'Inter', system-ui, sans-serif;
        }

        .dashboard-shell.admin-container {
            grid-template-columns: minmax(248px, 280px) 1fr;
            background:
                radial-gradient(circle at top right, rgba(124, 108, 242, 0.12), transparent 22%),
                radial-gradient(circle at bottom left, rgba(36, 180, 126, 0.08), transparent 18%),
                var(--dash-bg);
            color: var(--dash-text);
            font-family: 'Inter', system-ui, sans-serif;
        }

        .dashboard-shell .admin-sidebar {
            position: sticky;
            top: 0;
            height: 100vh;
            padding: 22px 18px 18px;
            border-right: 1px solid var(--dash-border);
            background:
                linear-gradient(180deg, rgba(19, 35, 58, 0.96), rgba(9, 18, 31, 0.98));
            backdrop-filter: blur(18px);
            box-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.03);
        }

        .dashboard-shell .sidebar-logo {
            margin-bottom: 20px;
        }

        .dashboard-shell #sidebar-header-root {
            padding: 24px 14px 18px 14px !important;
            margin-bottom: 12px !important;
            border-radius: 22px;
            border: 1px solid rgba(148, 163, 184, 0.12);
            background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02)) !important;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 30px rgba(2, 6, 23, 0.2) !important;
        }

        .dashboard-shell .premium-glass-container {
            width: 60px !important;
            height: 60px !important;
            border-radius: 18px !important;
            border: 1px solid rgba(148, 163, 184, 0.16) !important;
            background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02)) !important;
            box-shadow: none !important;
        }

        .dashboard-shell #sb-real-name {
            font-size: 0.98rem !important;
            font-weight: 600 !important;
            letter-spacing: -0.01em !important;
        }

        .dashboard-shell .plan-badge-premium {
            background: linear-gradient(135deg, rgba(213, 164, 71, 0.92), rgba(180, 131, 46, 0.92)) !important;
            box-shadow: none !important;
            text-shadow: none !important;
        }

        .dashboard-shell .sidebar-menu {
            flex: 1;
            gap: 8px;
        }

        .dashboard-shell .menu-item {
            min-height: 48px;
            padding: 12px 14px;
            border-radius: 14px;
            color: var(--dash-text-muted);
            gap: 12px;
            font-size: 0.95rem;
            font-weight: 500;
            border: 1px solid transparent;
            transition: background-color .2s ease, border-color .2s ease, color .2s ease, transform .2s ease;
        }

        .dashboard-shell .menu-item:hover {
            background: rgba(255,255,255,0.04);
            border-color: rgba(148, 163, 184, 0.12);
            color: var(--dash-text);
            transform: translateX(2px);
        }

        .dashboard-shell .menu-item.active {
            background: linear-gradient(180deg, rgba(124, 108, 242, 0.16), rgba(124, 108, 242, 0.08));
            border-color: rgba(124, 108, 242, 0.28);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
            color: #f8fbff;
        }

        .dashboard-shell .menu-item.logout {
            margin-top: auto;
            color: #f1b3b7;
            background: rgba(228, 108, 117, 0.06);
            border-color: rgba(228, 108, 117, 0.12);
        }

        .dashboard-shell .menu-item.logout:hover {
            background: rgba(228, 108, 117, 0.12);
            border-color: rgba(228, 108, 117, 0.2);
            color: #ffd2d6;
        }

        .menu-icon {
            width: 18px;
            height: 18px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            opacity: 0.92;
        }

        .menu-icon svg,
        .section-icon svg,
        .metric-icon svg,
        .action-icon svg,
        .state-icon svg {
            width: 100%;
            height: 100%;
            display: block;
        }

        .dashboard-shell .admin-content {
            padding: 28px;
            overflow-y: auto;
        }

        .dashboard-main {
            max-width: 1480px;
            margin: 0 auto;
        }

        @keyframes fadeInUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .anim-stagger { opacity:0; animation: fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
        .delay-1{animation-delay:.05s}.delay-2{animation-delay:.1s}.delay-3{animation-delay:.15s}
        .delay-4{animation-delay:.2s}.delay-5{animation-delay:.25s}.delay-6{animation-delay:.3s}
        .delay-7{animation-delay:.35s}.delay-8{animation-delay:.4s}

        .dashboard-shell :focus-visible {
            outline: 2px solid rgba(124, 108, 242, 0.88);
            outline-offset: 2px;
        }

        .dashboard-shell .section-grid {
            display: grid;
            gap: 18px;
            margin-bottom: 18px;
        }

        .saludo-bar {
            background:
                linear-gradient(180deg, rgba(20, 33, 53, 0.94), rgba(12, 23, 39, 0.94)),
                linear-gradient(90deg, rgba(124, 108, 242, 0.12), transparent);
            border: 1px solid var(--dash-border);
            box-shadow: var(--dash-shadow);
            color: var(--dash-text);
            border-radius: var(--dash-radius-lg);
            padding: 22px 24px;
            display: grid;
            grid-template-columns: 1fr auto;
            align-items: center;
            gap: 18px;
            margin-bottom: 18px;
        }

        .saludo-meta {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .saludo-eyebrow {
            color: var(--dash-text-muted);
            font-size: 0.8rem;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .saludo-text {
            font-size: clamp(1.5rem, 2vw, 2rem);
            line-height: 1.05;
            font-weight: 700;
            letter-spacing: -0.03em;
        }

        .saludo-date {
            font-size: 0.95rem;
            color: var(--dash-text-muted);
            margin: 0;
        }

        .saludo-actions {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .ghost-action,
        .dash-hamburger {
            width: 42px;
            height: 42px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 14px;
            border: 1px solid rgba(148, 163, 184, 0.14);
            background: rgba(255, 255, 255, 0.04);
            color: var(--dash-text);
            cursor: pointer;
            transition: background-color .2s ease, border-color .2s ease, transform .2s ease;
        }

        .ghost-action:hover,
        .dash-hamburger:hover {
            transform: translateY(-1px);
            background: rgba(255,255,255,0.08);
            border-color: rgba(148, 163, 184, 0.22);
        }

        .action-icon {
            width: 18px;
            height: 18px;
        }

        .dash-topbar {
            display: none;
            align-items: center;
            gap: 12px;
            padding: 12px 0 16px;
            position: sticky;
            top: 0;
            z-index: 100;
            background: linear-gradient(180deg, rgba(8, 17, 31, 0.96) 75%, rgba(8, 17, 31, 0));
            backdrop-filter: blur(10px);
        }

        .dash-topbar-title {
            font-weight: 600;
            font-size: 1rem;
            letter-spacing: -0.02em;
            color: var(--dash-text);
        }

        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 16px;
            margin-bottom: 18px;
        }

        .kpi-card {
            position: relative;
            overflow: hidden;
            min-height: 168px;
            padding: 20px;
            border-radius: var(--dash-radius-md);
            border: 1px solid var(--dash-border);
            background: linear-gradient(180deg, rgba(18, 31, 50, 0.94), rgba(11, 22, 36, 0.94));
            box-shadow: var(--dash-shadow);
            transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease;
        }

        .kpi-card:hover {
            transform: translateY(-3px);
            border-color: var(--dash-border-strong);
            box-shadow: 0 24px 40px rgba(2, 6, 23, 0.38);
        }

        .kpi-accent {
            width: 44px;
            height: 44px;
            border-radius: 14px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 18px;
            border: 1px solid currentColor;
            background: rgba(255,255,255,0.04);
            opacity: 0.95;
        }

        .metric-icon {
            width: 20px;
            height: 20px;
        }

        .kpi-label {
            font-size: 0.76rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--dash-text-muted);
            margin: 0 0 8px 0;
        }

        .kpi-number {
            font-size: clamp(1.8rem, 2.5vw, 2.35rem);
            font-weight: 800;
            line-height: 1;
            letter-spacing: -0.04em;
            margin: 0;
            color: var(--dash-text);
        }

        .kpi-sub {
            font-size: 0.86rem;
            font-weight: 500;
            color: var(--dash-text-muted);
            margin-top: 8px;
        }

        .report-section {
            background: linear-gradient(180deg, rgba(18, 31, 50, 0.96), rgba(11, 22, 36, 0.96));
            border: 1px solid var(--dash-border);
            border-radius: var(--dash-radius-md);
            overflow: hidden;
            box-shadow: var(--dash-shadow);
            transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease;
        }

        .report-section:hover {
            transform: translateY(-2px);
            border-color: rgba(148, 163, 184, 0.2);
            box-shadow: 0 24px 40px rgba(2, 6, 23, 0.34);
        }

        .report-header {
            padding: 18px 20px 14px;
            border-bottom: 1px solid var(--dash-border);
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 14px;
        }

        .report-heading {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            min-width: 0;
        }

        .section-icon {
            width: 38px;
            height: 38px;
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            background: rgba(255,255,255,0.04);
            color: var(--dash-text-muted);
            border: 1px solid rgba(148, 163, 184, 0.14);
        }

        .report-title-wrap {
            min-width: 0;
        }

        .report-title {
            font-size: 1rem;
            font-weight: 600;
            color: var(--dash-text);
            margin: 0 0 4px 0;
            letter-spacing: -0.02em;
        }

        .report-subtitle,
        .report-tag {
            font-size: 0.8rem;
            color: var(--dash-text-muted);
        }

        .report-tag {
            display: inline-flex;
            align-items: center;
            white-space: nowrap;
            padding: 8px 12px;
            border-radius: 999px;
            border: 1px solid rgba(148, 163, 184, 0.14);
            background: rgba(255,255,255,0.03);
            font-weight: 600;
        }

        .report-body {
            padding: 18px 20px 20px;
        }

        .alert-row {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 13px 14px;
            border-radius: 14px;
            margin-bottom: 10px;
            font-size: 0.88rem;
            font-weight: 500;
            border: 1px solid transparent;
        }
        .alert-row:last-child { margin-bottom: 0; }
        .alert-critical { background:rgba(228,108,117,.12);  border-color:rgba(228,108,117,.22);  color:#ffd4d7; }
        .alert-warning  { background:rgba(213,164,71,.11); border-color:rgba(213,164,71,.22); color:#f4dfae; }
        .alert-ok       { background:rgba(36,180,126,.12); border-color:rgba(36,180,126,.2); color:#c7f0df; }

        .state-icon {
            width: 18px;
            height: 18px;
            flex-shrink: 0;
            margin-top: 1px;
        }

        .state-card {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 16px;
            border-radius: 16px;
            border: 1px dashed rgba(148, 163, 184, 0.2);
            background: rgba(255,255,255,0.02);
            color: var(--dash-text-muted);
            font-size: 0.9rem;
        }

        .state-card strong {
            display: block;
            color: var(--dash-text);
            font-weight: 600;
            margin-bottom: 4px;
        }

        .compare-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid var(--dash-border);
            gap: 12px;
        }
        .compare-row:last-child { border-bottom: none; }
        .compare-label   { font-size: 0.88rem; color: var(--dash-text-muted); }
        .compare-values  { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
        .compare-current { font-weight: 700; font-size: 1rem; color: var(--dash-text); letter-spacing: -0.02em; }
        .trend-badge     { padding: 5px 10px; border-radius: 999px; font-size: 0.74rem; font-weight: 700; }
        .trend-up   { background:rgba(36,180,126,.14); color:#bcf0d7; }
        .trend-down { background:rgba(228,108,117,.14); color:#ffd4d7; }
        .trend-flat { background:rgba(148,163,184,.12); color:#c7d2e3; }
        .comparison-summary {
            margin-top: 14px;
            padding: 13px 14px;
            border-radius: 14px;
            background: rgba(255,255,255,0.03);
            border: 1px solid var(--dash-border);
            font-size: 0.82rem;
            color: var(--dash-text-muted);
        }

        .product-rank-item {
            display: grid;
            grid-template-columns: auto minmax(0,1fr) auto;
            align-items: center;
            gap: 12px;
            padding: 12px 0;
            border-bottom: 1px solid var(--dash-border);
        }
        .product-rank-item:last-child { border-bottom: none; }
        .rank-number {
            width: 34px;
            height: 34px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 0.8rem;
            flex-shrink: 0;
        }
        .rank-bar-wrap { flex: 1; min-width: 0; }
        .rank-name {
            font-size: 0.9rem;
            font-weight: 600;
            color: var(--dash-text);
            margin-bottom: 7px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .rank-bar-bg {
            height: 8px;
            background: rgba(148, 163, 184, 0.12);
            border-radius: 999px;
            overflow: hidden;
        }
        .rank-bar-fill { height: 100%; border-radius: 999px; transition: width 1s ease; }
        .rank-qty      { font-weight: 700; font-size: 0.92rem; color: var(--dash-text); white-space: nowrap; text-align: right; }

        .debt-client-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid var(--dash-border);
            gap: 12px;
        }
        .debt-client-row:last-child { border-bottom: none; }
        .debt-summary,
        .capital-summary {
            border-radius: 16px;
            padding: 14px 16px;
            margin-bottom: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            border: 1px solid transparent;
        }
        .debt-summary {
            background: rgba(228,108,117,.08);
            border-color: rgba(228,108,117,.18);
        }
        .capital-summary {
            background: rgba(213,164,71,.08);
            border-color: rgba(213,164,71,.18);
        }
        .summary-label {
            font-size: 0.8rem;
            color: var(--dash-text-muted);
        }
        .summary-value {
            font-size: 1rem;
            font-weight: 700;
            letter-spacing: -0.02em;
        }

        .dead-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px dashed rgba(148, 163, 184, 0.18);
            font-size: 0.88rem;
            gap: 12px;
        }
        .dead-item:last-child { border-bottom: none; }

        .status-pill {
            font-size: 0.72rem;
            font-weight: 700;
            padding: 5px 10px;
            border-radius: 999px;
            white-space: nowrap;
        }

        .low-stock-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
        }

        .low-stock-card {
            padding: 14px;
            border-radius: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            border: 1px solid transparent;
            transition: transform .2s ease, border-color .2s ease;
        }

        .low-stock-card:hover {
            transform: translateY(-2px);
        }

        .chart-toolbar {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        .chart-pill {
            padding: 7px 12px;
            border-radius: 999px;
            border: 1px solid rgba(148, 163, 184, 0.14);
            background: rgba(255,255,255,0.03);
            color: var(--dash-text-muted);
            font-size: 0.76rem;
            font-weight: 600;
        }

        .chart-pill.is-active {
            color: var(--dash-text);
            border-color: rgba(124, 108, 242, 0.26);
            background: rgba(124, 108, 242, 0.12);
        }

        .premium-blur-container { position: relative; overflow: hidden; border-radius: 10px; }
        .premium-blur-content   { filter: blur(8px); opacity: .6; pointer-events: none; user-select: none; }
        .premium-lock-overlay {
            position: absolute; top:0; left:0; width:100%; height:100%; z-index:50;
            cursor: pointer; display: flex; flex-direction: column;
            justify-content: center; align-items: center;
            background: rgba(8,17,31,.42); transition: background .3s;
        }
        .premium-lock-overlay:hover { background: rgba(8,17,31,.54); }
        .lock-badge {
            width: 52px;
            height: 52px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
            margin-bottom: 10px;
            background: rgba(255,255,255,.08);
            color: var(--dash-text);
        }
        .lock-text {
            font-weight: 600;
            color: var(--dash-text);
            background: rgba(8,17,31,.7);
            border: 1px solid rgba(148, 163, 184, 0.14);
            padding: 8px 14px;
            border-radius: 999px;
        }

        .dash-topbar-right { margin-left: auto; display: flex; gap: 8px; align-items: center; }

        @media(max-width: 1100px) {
            .kpi-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .low-stock-grid {
                grid-template-columns: 1fr;
            }
        }

        @media(max-width: 768px) {
            .dash-topbar { display: flex; }
            .dash-desktop-header { display: none; }
            .dashboard-shell.admin-container {
                display: block;
            }
            .dashboard-shell .admin-sidebar {
                position: fixed;
                left: 0;
                top: 0;
                z-index: 2000;
                width: min(86vw, 300px);
                transform: translateX(-100%);
                transition: transform .28s ease;
                box-shadow: 20px 0 50px rgba(2, 6, 23, 0.45);
            }
            .dashboard-shell .admin-sidebar.active {
                transform: translateX(0);
            }
            .dashboard-shell .sidebar-overlay {
                position: fixed;
                inset: 0;
                z-index: 1999;
                background: rgba(2, 6, 23, 0.56);
                backdrop-filter: blur(3px);
            }
            .dashboard-shell .sidebar-overlay.active {
                display: block;
            }
            .dashboard-shell .admin-content { padding: 16px; }
            .saludo-bar {
                grid-template-columns: 1fr;
                padding: 18px;
                gap: 14px;
            }
            .row-2col,
            .row-auto,
            .kpi-grid {
                grid-template-columns: 1fr !important;
            }
            .kpi-card {
                min-height: auto;
            }
            .report-header,
            .report-body {
                padding-left: 16px;
                padding-right: 16px;
            }
            .report-header {
                flex-direction: column;
                align-items: stretch;
            }
            .compare-row,
            .product-rank-item,
            .debt-client-row,
            .dead-item {
                grid-template-columns: 1fr;
                align-items: flex-start;
            }
            .compare-values,
            .rank-qty {
                justify-content: flex-start;
                text-align: left;
            }
            .chart-container { height: 220px !important; }
        }

        @media(max-width: 400px) {
            .kpi-grid { grid-template-columns: 1fr !important; }
            .saludo-text { font-size: 1.35rem; }
            .chart-pill { width: 100%; justify-content: center; display: inline-flex; }
        }
    </style>

    <div class="admin-container dashboard-shell">
        <div class="sidebar-overlay" id="sidebar-overlay"></div>

        <aside class="admin-sidebar" id="admin-sidebar">
            <div class="sidebar-logo">${renderSidebarHeader()}</div>
            <nav class="sidebar-menu">
                <button class="menu-item active" aria-current="page"><span class="menu-icon">${icon('dashboard')}</span><span>Dashboard</span></button>
                <button class="menu-item" id="nav-orders" onclick="return window.checkPlan(event,'web_orders')"><span class="menu-icon">${icon('orders')}</span><span>${lockOrders}Pedidos web</span></button>
                <button class="menu-item" id="nav-inventory"><span class="menu-icon">${icon('inventory')}</span><span>Inventario</span></button>
                <button class="menu-item" id="nav-pos"><span class="menu-icon">${icon('pos')}</span><span>Ir a caja</span></button>
                <button class="menu-item" id="nav-suppliers" onclick="return window.checkPlan(event,'suppliers')"><span class="menu-icon">${icon('suppliers')}</span><span>${lockSuppliers}Estados de cuenta</span></button>
                <button class="menu-item" id="nav-history" onclick="return window.checkPlan(event,'history')"><span class="menu-icon">${icon('history')}</span><span>${lockHistory}Historial</span></button>
                <button class="menu-item" id="nav-settings" onclick="return window.checkPlan(event,'settings')"><span class="menu-icon">${icon('settings')}</span><span>${lockSettings}Configuración</span></button>
                <button class="menu-item logout" id="nav-logout"><span class="menu-icon">${icon('logout')}</span><span>Salir</span></button>
            </nav>
        </aside>

        <main class="admin-content">
            <div class="dash-topbar">
                <button class="dash-hamburger" id="mobile-menu-btn" aria-label="Abrir menú"><span class="action-icon">${icon('dashboard')}</span></button>
                <span class="dash-topbar-title">Dashboard</span>
                <div class="dash-topbar-right">
                    <button id="theme-toggle-dash-mobile" class="ghost-action" aria-label="Cambiar tema"><span class="action-icon">${icon('theme')}</span></button>
                </div>
            </div>

            <div class="dashboard-main">
            <div class="saludo-bar anim-stagger delay-1">
                <div class="saludo-meta">
                    <div class="saludo-eyebrow">Resumen general</div>
                    <div class="saludo-text">${getSaludo()}</div>
                    <div class="saludo-date">${getDayName()}</div>
                </div>
                <div class="saludo-actions dash-desktop-header">
                    <button id="theme-toggle-dash" class="ghost-action" aria-label="Cambiar tema"><span class="action-icon">${icon('theme')}</span></button>
                </div>
            </div>

            <div class="kpi-grid anim-stagger delay-2">
                <div class="kpi-card" style="color:#74a7ff;">
                    <div class="kpi-accent"><span class="metric-icon">${icon('sales')}</span></div>
                    <p class="kpi-label">Vendí hoy</p>
                    <p id="kpi-today" class="kpi-number">$0.00</p>
                    <p class="kpi-sub" id="kpi-today-txn">0 ventas realizadas</p>
                </div>

                <div class="kpi-card" style="color:#46c893;">
                    <div class="kpi-accent"><span class="metric-icon">${icon('profit')}</span></div>
                    <p class="kpi-label">Gané hoy</p>
                    <p id="kpi-profit" class="kpi-number">$0.00</p>
                    <p class="kpi-sub">Después de costos</p>
                </div>

                <div class="kpi-card" style="color:#9b8cff;">
                    <div class="kpi-accent"><span class="metric-icon">${icon('month')}</span></div>
                    <p class="kpi-label">Total del mes</p>
                    <p id="kpi-month" class="kpi-number">$0.00</p>
                    <p class="kpi-sub" id="kpi-month-days">Este mes hasta hoy</p>
                </div>

                <div class="kpi-card" style="color:#ebc16c;">
                    <div class="kpi-accent"><span class="metric-icon">${icon('avg')}</span></div>
                    <p class="kpi-label">Ticket promedio</p>
                    <p id="kpi-avg" class="kpi-number">$0.00</p>
                    <p class="kpi-sub">Por venta</p>
                </div>
            </div>

            <div class="section-grid row-2col anim-stagger delay-4" style="grid-template-columns:1fr 1fr;">
                <div class="report-section">
                    <div class="report-header">
                        <div class="report-heading">
                            <span class="section-icon">${icon('alert')}</span>
                            <div class="report-title-wrap">
                                <h3 class="report-title">Alertas importantes</h3>
                                <div class="report-subtitle">Puntos que requieren atención</div>
                            </div>
                        </div>
                        <span class="report-tag">Atención</span>
                    </div>
                    <div class="report-body" id="alertas-container">
                        <div class="state-card"><span class="state-icon">${icon('empty')}</span><div><strong>Revisando información</strong>Estamos preparando tus alertas del día.</div></div>
                    </div>
                </div>

                <div class="report-section">
                    <div class="report-header">
                        <div class="report-heading">
                            <span class="section-icon">${icon('trend')}</span>
                            <div class="report-title-wrap">
                                <h3 class="report-title">¿Cómo voy?</h3>
                                <div class="report-subtitle">Esta semana frente a la anterior</div>
                            </div>
                        </div>
                        <span class="report-tag">Comparativo</span>
                    </div>
                    <div class="report-body" id="comparativo-container">
                        <div class="state-card"><span class="state-icon">${icon('empty')}</span><div><strong>Calculando comparativo</strong>Estamos consolidando tu evolución semanal.</div></div>
                    </div>
                </div>
            </div>

            <div class="section-grid row-auto anim-stagger delay-5" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));">
                <div class="report-section">
                    <div class="report-header">
                        <div class="report-heading">
                            <span class="section-icon">${icon('products')}</span>
                            <div class="report-title-wrap">
                                <h3 class="report-title">Lo que más se vende</h3>
                                <div class="report-subtitle">Últimos 30 días</div>
                            </div>
                        </div>
                        <span class="report-tag">Top 5</span>
                    </div>
                    <div class="report-body" id="top-products-list">
                        <div class="state-card"><span class="state-icon">${icon('empty')}</span><div><strong>Generando ranking</strong>Estamos ordenando tus productos con mejor salida.</div></div>
                    </div>
                </div>

                <div class="report-section premium-blur-container">
                    <div class="report-header">
                        <div class="report-heading">
                            <span class="section-icon">${icon('chart')}</span>
                            <div class="report-title-wrap">
                                <h3 class="report-title">Ventas últimos 7 días</h3>
                                <div class="report-subtitle">Tendencia reciente de ventas y costos</div>
                            </div>
                        </div>
                        <div class="chart-toolbar" aria-label="Rangos de tiempo disponibles">
                            <span class="chart-pill is-active">7 días</span>
                            <span class="chart-pill">30 días</span>
                            <span class="chart-pill">Mes actual</span>
                        </div>
                    </div>
                    ${chartOverlay}
                    <div class="${chartBlurClass}" style="padding:18px 20px 20px;">
                        <div class="chart-container" style="position:relative;height:280px;">
                            <canvas id="salesChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <div class="section-grid row-auto anim-stagger delay-6" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));">
                <div class="report-section">
                    <div class="report-header">
                        <div class="report-heading">
                            <span class="section-icon">${icon('debt')}</span>
                            <div class="report-title-wrap">
                                <h3 class="report-title">Clientes que te deben</h3>
                                <div class="report-subtitle">Seguimiento de saldos pendientes</div>
                            </div>
                        </div>
                        <span class="report-tag">Por cobrar</span>
                    </div>
                    <div class="report-body" id="deudores-container">
                        <div class="state-card"><span class="state-icon">${icon('empty')}</span><div><strong>Consultando saldos</strong>Estamos trayendo la cartera pendiente.</div></div>
                    </div>
                </div>

                <div class="report-section">
                    <div class="report-header">
                        <div class="report-heading">
                            <span class="section-icon">${icon('slow')}</span>
                            <div class="report-title-wrap">
                                <h3 class="report-title">Productos sin movimiento</h3>
                                <div class="report-subtitle">Sin ventas en los últimos 30 días</div>
                            </div>
                        </div>
                        <span class="report-tag">Rotación</span>
                    </div>
                    <div class="report-body" id="dead-stock-container">
                        <div class="state-card"><span class="state-icon">${icon('empty')}</span><div><strong>Analizando inventario</strong>Estamos detectando productos con baja rotación.</div></div>
                    </div>
                </div>
            </div>

            <div class="report-section anim-stagger delay-7" style="margin-bottom:30px;">
                <div class="report-header">
                    <div class="report-heading">
                        <span class="section-icon">${icon('stock')}</span>
                        <div class="report-title-wrap">
                            <h3 class="report-title">Productos que se están acabando</h3>
                            <div class="report-subtitle">Inventario que conviene surtir pronto</div>
                        </div>
                    </div>
                    <span class="report-tag">Stock bajo</span>
                </div>
                <div class="report-body" id="low-stock-list">
                    <div class="state-card"><span class="state-icon">${icon('empty')}</span><div><strong>Revisando inventario</strong>Estamos detectando niveles bajos de stock.</div></div>
                </div>
            </div>
            </div>
        </main>
    </div>
    `;
}

// ── Setup ──────────────────────────────────────────────────────
export async function setupDashboardLogic(router) {

    Chart.defaults.color = '#90a2bf';
    Chart.defaults.borderColor = 'rgba(148, 163, 184, 0.18)';
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,23,42,0.9)';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;

    // ── Menú móvil ────────────────────────────────────────────
    const sidebar    = document.getElementById('admin-sidebar');
    const overlay    = document.getElementById('sidebar-overlay');
    // El botón hamburguesa ahora SÍ existe en el HTML (dash-topbar)
    const btnOpen    = document.getElementById('mobile-menu-btn');

    function toggleMenu(show) {
        sidebar?.classList.toggle('active', show);
        overlay?.classList.toggle('active', show);
    }
    btnOpen?.addEventListener('click',  () => toggleMenu(true));
    overlay?.addEventListener('click',  () => toggleMenu(false));

    // ── Tema: dos botones (escritorio y móvil) ────────────────
    const toggleTheme = () => ThemeService.toggle();
    document.getElementById('theme-toggle-dash')?.addEventListener('click',        toggleTheme);
    document.getElementById('theme-toggle-dash-mobile')?.addEventListener('click', toggleTheme);

    // ── Navegación ────────────────────────────────────────────
    const navTo = (path) => { toggleMenu(false); router.navigate(path); };
    const bind  = (id, path) => document.getElementById(id)?.addEventListener('click', () => navTo(path));

    bind('nav-inventory', '/admin/inventory');
    bind('nav-pos',       '/pos');
    bind('nav-orders',    '/admin/orders');
    bind('nav-history',   '/admin/history');
    bind('nav-settings',  '/admin/settings');
    bind('nav-suppliers', '/admin/suppliers');

    document.getElementById('nav-logout')?.addEventListener('click', async () => {
        await supabase.auth.signOut(); navTo('/');
    });

    // ── Carga de datos ────────────────────────────────────────
    async function loadMetrics() {
        const businessId = localStorage.getItem('archsell_business_id');
        let localSales = [], localProducts = [];

        try {
            if (businessId && db?.sales && db?.products) {
                try {
                    localSales    = await db.sales.where('business_id').equals(businessId).toArray();
                    localProducts = await db.products.where('business_id').equals(businessId).toArray();
                } catch {
                    localSales    = (await db.sales.toArray()).filter(s => String(s.business_id) === String(businessId));
                    localProducts = (await db.products.toArray()).filter(p => String(p.business_id) === String(businessId));
                }
            }
        } catch (err) { console.error('Error DB local:', err); }

        processAndRender(localSales, localProducts);

        if (navigator.onLine) {
            try {
                await Promise.all([syncService.downloadSalesHistory(), syncService.downloadProducts()]);
                try {
                    localSales    = await db.sales.where('business_id').equals(businessId).toArray();
                    localProducts = await db.products.where('business_id').equals(businessId).toArray();
                } catch {
                    localSales    = (await db.sales.toArray()).filter(s => String(s.business_id) === String(businessId));
                    localProducts = (await db.products.toArray()).filter(p => String(p.business_id) === String(businessId));
                }
                processAndRender(localSales, localProducts);
            } catch (err) { console.warn('Sync background error:', err); }
        }

        loadClientDebt();
    }

    async function processAndRender(rawSales, products) {
        const uniqueSalesMap = new Map();
        (rawSales || []).forEach(s => {
            if (s.status === 'cancelado') return;
            uniqueSalesMap.set(s.uuid || s.id, s);
        });
        const sales = Array.from(uniqueSalesMap.values());

        calculateKPIs(sales, products);
        renderAlertas(sales, products);
        renderComparativo(sales);
        renderTopProducts(sales, products);
        renderDeadStock(sales, products);
        renderLowStock(products);

        if (PermissionService.can('history')) renderSalesChart(sales, products);
    }

    // ── KPIs ──────────────────────────────────────────────────
    function calculateKPIs(sales, products) {
        const todayStr     = new Date().toDateString();
        const currentMonth = new Date().getMonth();
        const currentYear  = new Date().getFullYear();
        let todaySales = 0, monthSales = 0, todayProfit = 0, todayTxn = 0;

        const costMap = new Map();
        (products || []).forEach(p => {
            const cost = Number(p.cost_price);
            if (!isNaN(cost)) {
                if (p.id)   costMap.set(String(p.id), cost);
                if (p.name) costMap.set(`name:${p.name}`, cost);
            }
        });

        (sales || []).forEach(s => {
            const d = new Date(s.date || s.created_at || s.createdAt);
            if (isNaN(d.getTime())) return;
            const totalVenta = Number(s.total || 0);
            const isToday    = d.toDateString() === todayStr;
            const isMonth    = d.getMonth() === currentMonth && d.getFullYear() === currentYear;

            if (isToday) { todaySales += totalVenta; todayTxn++; }
            if (isMonth) monthSales += totalVenta;

            if (isToday && Array.isArray(s.items)) {
                let saleCost = 0;
                s.items.forEach(item => {
                    if (item.type === 'meta') return;
                    const qty      = Number(item.cantidad || item.qty || item.quantity || 0);
                    const unitCost = item.historical_cost !== undefined
                        ? Number(item.historical_cost)
                        : (costMap.get(String(item.id)) || costMap.get(`name:${item.name}`) || 0);
                    saleCost += unitCost * qty;
                });
                todayProfit += (totalVenta - saleCost);
            }
        });

        const avg = todayTxn > 0 ? todaySales / todayTxn : 0;
        animateValue('kpi-today',  0, todaySales,   1200);
        animateValue('kpi-profit', 0, todayProfit,  1200);
        animateValue('kpi-month',  0, monthSales,   1400);
        animateValue('kpi-avg',    0, avg,           1000);

        const txnEl = document.getElementById('kpi-today-txn');
        if (txnEl) txnEl.textContent = `${todayTxn} venta${todayTxn !== 1 ? 's' : ''} realizada${todayTxn !== 1 ? 's' : ''}`;

        const monthEl = document.getElementById('kpi-month-days');
        if (monthEl) monthEl.textContent = `Primeros ${new Date().getDate()} días del mes`;
    }

    // ── Alertas ───────────────────────────────────────────────
    function renderAlertas(sales, products) {
        const el = document.getElementById('alertas-container');
        if (!el) return;
        const alertas  = [];
        const todayStr = new Date().toDateString();

        const agotados  = (products || []).filter(p => Number(p.stock) <= 0);
        const stockBajo = (products || []).filter(p => Number(p.stock) > 0 && Number(p.stock) <= 5);
        const ventasHoy = (sales || []).filter(s => new Date(s.date || s.created_at).toDateString() === todayStr);

        if (agotados.length > 0) alertas.push({ tipo: 'critical', icon: '🚫', texto: `${agotados.length} producto${agotados.length > 1 ? 's' : ''} AGOTADO${agotados.length > 1 ? 'S' : ''}: ${agotados.slice(0,2).map(p => p.name).join(', ')}${agotados.length > 2 ? '...' : ''}` });
        if (stockBajo.length > 0) alertas.push({ tipo: 'warning', icon: '⚠️', texto: `${stockBajo.length} producto${stockBajo.length > 1 ? 's' : ''} con poco stock: ${stockBajo.slice(0,2).map(p => `${p.name} (${p.stock})`).join(', ')}` });
        if (ventasHoy.length === 0) alertas.push({ tipo: 'warning', icon: '📭', texto: 'Aún no hay ventas registradas hoy.' });
        if (agotados.length === 0 && stockBajo.length === 0 && ventasHoy.length > 0) alertas.push({ tipo: 'ok', icon: '✅', texto: `¡Todo en orden! Llevas ${ventasHoy.length} venta${ventasHoy.length > 1 ? 's' : ''} hoy.` });

        el.innerHTML = alertas.length === 0
            ? `<div class="state-card" style="border-style:solid;color:#c7f0df;background:rgba(36,180,126,.08);border-color:rgba(36,180,126,.18);"><span class="state-icon">${icon('alert')}</span><div><strong>Sin alertas por ahora</strong>Todo se ve en orden en tu operación de hoy.</div></div>`
            : alertas.map(a => `
                <div class="alert-row ${a.tipo === 'critical' ? 'alert-critical' : a.tipo === 'warning' ? 'alert-warning' : 'alert-ok'}">
                    <span class="state-icon">${icon('alert')}</span>
                    <span>${a.texto}</span>
                </div>`).join('');
    }

    // ── Comparativo semana ────────────────────────────────────
    function renderComparativo(sales) {
        const el = document.getElementById('comparativo-container');
        if (!el) return;
        const now = new Date();
        const dow = now.getDay();
        const startThisWeek = new Date(now); startThisWeek.setDate(now.getDate() - dow); startThisWeek.setHours(0,0,0,0);
        const startLastWeek = new Date(startThisWeek); startLastWeek.setDate(startThisWeek.getDate() - 7);
        const endLastWeek   = new Date(startThisWeek); endLastWeek.setMilliseconds(-1);
        let thisWeekSales = 0, lastWeekSales = 0, thisWeekTxn = 0, lastWeekTxn = 0;

        (sales || []).forEach(s => {
            const d = new Date(s.date || s.created_at);
            if (isNaN(d.getTime())) return;
            const total = Number(s.total || 0);
            if (d >= startThisWeek)                        { thisWeekSales += total; thisWeekTxn++; }
            else if (d >= startLastWeek && d <= endLastWeek) { lastWeekSales += total; lastWeekTxn++; }
        });

        const trendIcon = (curr, prev) => {
            if (prev === 0) return curr > 0 ? `<span class="trend-badge trend-up">▲ Nuevo</span>` : `<span class="trend-badge trend-flat">— Sin datos</span>`;
            const pct = ((curr - prev) / prev * 100).toFixed(0);
            if (curr > prev) return `<span class="trend-badge trend-up">▲ +${pct}%</span>`;
            if (curr < prev) return `<span class="trend-badge trend-down">▼ ${pct}%</span>`;
            return `<span class="trend-badge trend-flat">= Igual</span>`;
        };

        el.innerHTML = `
            <div class="compare-row">
                <span class="compare-label">Ventas esta semana</span>
                <div class="compare-values">
                    <span class="compare-current">${fmt(thisWeekSales)}</span>
                    ${trendIcon(thisWeekSales, lastWeekSales)}
                </div>
            </div>
            <div class="compare-row">
                <span class="compare-label">Número de ventas</span>
                <div class="compare-values">
                    <span class="compare-current">${thisWeekTxn} ventas</span>
                    ${trendIcon(thisWeekTxn, lastWeekTxn)}
                </div>
            </div>
            <div class="comparison-summary">
                Semana pasada: <strong style="color:var(--dash-text);">${fmt(lastWeekSales)}</strong> en ${lastWeekTxn} ventas
            </div>`;
    }

    // ── Top productos ─────────────────────────────────────────
    function renderTopProducts(sales, products) {
        const el = document.getElementById('top-products-list');
        if (!el) return;
        const nameById = {};
        (products || []).forEach(p => { if (p.id) nameById[String(p.id)] = p.name; });
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
        const countsById = {};
        (sales || []).forEach(s => {
            const d = new Date(s.date || s.created_at);
            if (isNaN(d.getTime()) || d < cutoff) return;
            (s.items || []).forEach(i => {
                if (i.type === 'meta') return;
                const qty = Number(i.cantidad || i.qty || i.quantity || 0);
                const key = i.id ? String(i.id) : `n:${i.name}`;
                countsById[key] = (countsById[key] || 0) + qty;
                if (!nameById[key] && i.name) nameById[key] = i.name;
            });
        });
        const sorted = Object.entries(countsById).sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (sorted.length === 0) { el.innerHTML = `<div class="state-card"><span class="state-icon">${icon('products')}</span><div><strong>Aún no hay suficientes ventas</strong>En cuanto se registren más movimientos verás aquí el ranking.</div></div>`; return; }
        const maxQty  = sorted[0][1];
        const colors  = ['#74a7ff','#46c893','#ebc16c','#e48b92','#9b8cff'];
        const medals  = ['1','2','3','4','5'];
        el.innerHTML = sorted.map(([key, qty], idx) => {
            const name = nameById[key] || key.replace('n:','');
            const pct  = Math.round((qty / maxQty) * 100);
            return `
            <div class="product-rank-item">
                <div class="rank-number" style="background:${colors[idx]}22;color:${colors[idx]};">${medals[idx]}</div>
                <div class="rank-bar-wrap">
                    <div class="rank-name">${name}</div>
                    <div class="rank-bar-bg"><div class="rank-bar-fill" style="width:${pct}%;background:${colors[idx]};"></div></div>
                </div>
                <div class="rank-qty" style="color:${colors[idx]};">${fmtNum(qty)} <span style="font-size:0.72rem;font-weight:500;color:var(--dash-text-muted);">uds</span></div>
            </div>`;
        }).join('');
    }

    // ── Deudores ──────────────────────────────────────────────
    async function loadClientDebt() {
        const el = document.getElementById('deudores-container');
        if (!el) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: charges, error } = await supabase
                .from('customer_charges')
                .select('customer_id, type, amount, customers(name, phone)')
                .eq('user_id', user.id);
            if (error) { el.innerHTML = `<div class="state-card"><span class="state-icon">${icon('debt')}</span><div><strong>Módulo de clientes no disponible</strong>Actívalo para ver las deudas por cobrar.</div></div>`; return; }
            const clientMap = {};
            (charges || []).forEach(c => {
                const cid = c.customer_id;
                if (!clientMap[cid]) clientMap[cid] = { name: c.customers?.name || 'Cliente', phone: c.customers?.phone || '', balance: 0 };
                clientMap[cid].balance += c.type === 'charge' ? Number(c.amount) : -Number(c.amount);
            });
            const deudores    = Object.values(clientMap).filter(c => c.balance > 0.5).sort((a,b) => b.balance - a.balance).slice(0,5);
            const totalDeuda  = Object.values(clientMap).reduce((acc, c) => acc + (c.balance > 0 ? c.balance : 0), 0);
            if (deudores.length === 0) { el.innerHTML = `<div class="state-card" style="border-style:solid;color:#c7f0df;background:rgba(36,180,126,.08);border-color:rgba(36,180,126,.18);"><span class="state-icon">${icon('debt')}</span><div><strong>Sin deuda pendiente</strong>Ningún cliente tiene saldo por cobrar en este momento.</div></div>`; return; }
            el.innerHTML = `
                <div class="debt-summary">
                    <span class="summary-label">Total por cobrar</span>
                    <strong class="summary-value" style="color:#ffd4d7;">${fmt(totalDeuda)}</strong>
                </div>
                ${deudores.map(c => `
                <div class="debt-client-row">
                    <div>
                        <div style="font-weight:600;color:var(--dash-text);font-size:0.92rem;">${c.name}</div>
                        ${c.phone ? `<div style="font-size:0.78rem;color:var(--dash-text-muted);">${c.phone}</div>` : ''}
                    </div>
                    <div style="font-weight:700;color:#ffd4d7;">${fmt(c.balance)}</div>
                </div>`).join('')}`;
        } catch (e) {
            el.innerHTML = `<div class="state-card"><span class="state-icon">${icon('debt')}</span><div><strong>No fue posible consultar clientes</strong>Activa el módulo de clientes para usar este panel.</div></div>`;
        }
    }

    // ── Stock muerto ──────────────────────────────────────────
    function renderDeadStock(sales, products) {
        const el = document.getElementById('dead-stock-container');
        if (!el) return;
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
        const soldIds = new Set();
        (sales || []).forEach(s => {
            const d = new Date(s.date || s.created_at);
            if (isNaN(d.getTime()) || d < cutoff) return;
            (s.items || []).forEach(i => {
                if (i.type === 'meta') return;
                if (i.id)   soldIds.add(String(i.id));
                if (i.name) soldIds.add(`name:${i.name}`);
            });
        });
        const dead = (products || []).filter(p => Number(p.stock) > 0 && !soldIds.has(String(p.id)) && !soldIds.has(`name:${p.name}`)).slice(0, 5);
        if (dead.length === 0) { el.innerHTML = `<div class="state-card" style="border-style:solid;color:#c7f0df;background:rgba(36,180,126,.08);border-color:rgba(36,180,126,.18);"><span class="state-icon">${icon('slow')}</span><div><strong>Todo tu inventario se está moviendo</strong>No hay productos con stock detenido en los últimos 30 días.</div></div>`; return; }
        const totalCapital = dead.reduce((acc, p) => acc + (Number(p.cost_price || 0) * Number(p.stock)), 0);
        el.innerHTML = `
            <div class="capital-summary">
                <span class="summary-label">Capital inmovilizado estimado</span>
                <strong class="summary-value" style="color:#f4dfae;">${fmt(totalCapital)}</strong>
            </div>
            ${dead.map(p => `
            <div class="dead-item">
                <div>
                    <div style="font-weight:600;color:var(--dash-text);">${p.name}</div>
                    <div style="font-size:0.76rem;color:var(--dash-text-muted);">Stock: ${p.stock} · Costo: ${fmt(p.cost_price || 0)}</div>
                </div>
                <span class="status-pill" style="background:rgba(213,164,71,.12);color:#f4dfae;">Sin ventas</span>
            </div>`).join('')}`;
    }

    // ── Stock bajo ────────────────────────────────────────────
    function renderLowStock(products) {
        const el = document.getElementById('low-stock-list');
        if (!el) return;
        const low = (products || []).filter(p => !isNaN(Number(p.stock)) && Number(p.stock) <= 10).sort((a,b) => Number(a.stock) - Number(b.stock)).slice(0, 10);
        if (low.length === 0) { el.innerHTML = `<div class="state-card" style="border-style:solid;color:#c7f0df;background:rgba(36,180,126,.08);border-color:rgba(36,180,126,.18);"><span class="state-icon">${icon('stock')}</span><div><strong>Inventario en buen nivel</strong>Todo el stock actual se encuentra dentro de rangos saludables.</div></div>`; return; }
        el.innerHTML = `
            <div class="low-stock-grid">
                ${low.map(p => {
                    const stock      = Number(p.stock);
                    const isCritical = stock <= 0;
                    const color      = isCritical ? '#ffd4d7' : '#f4dfae';
                    const bg         = isCritical ? 'rgba(228,108,117,.08)' : 'rgba(213,164,71,.08)';
                    const border     = isCritical ? 'rgba(228,108,117,.18)' : 'rgba(213,164,71,.18)';
                    return `
                    <div class="low-stock-card" style="background:${bg};border-color:${border};">
                        <span style="font-size:0.86rem;font-weight:600;color:var(--dash-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name}</span>
                        <span class="status-pill" style="background:rgba(255,255,255,.05);color:${color};">${isCritical ? 'Agotado' : stock + ' uds'}</span>
                    </div>`;
                }).join('')}
            </div>`;
    }

    // ── Gráfica ventas 7 días ─────────────────────────────────
    function renderSalesChart(sales, products) {
        const canvas = document.getElementById('salesChart');
        if (!canvas) return;
        const costMap = new Map();
        (products || []).forEach(p => {
            const c = Number(p.cost_price);
            if (!isNaN(c)) { if (p.id) costMap.set(String(p.id), c); if (p.name) costMap.set(p.name, c); }
        });
        const last7 = {}, keys = [];
        for (let i = 6; i >= 0; i--) {
            const d   = new Date(); d.setDate(d.getDate() - i);
            const key = d.toDateString();
            last7[key] = { label: d.toLocaleDateString('es-MX', { weekday:'short', day:'numeric' }), sales: 0, costs: 0 };
            keys.push(key);
        }
        (sales || []).forEach(s => {
            const d = new Date(s.date || s.created_at);
            if (isNaN(d.getTime())) return;
            const key = d.toDateString();
            if (!last7[key]) return;
            const total = Number(s.total || 0);
            let cost = 0;
            (s.items || []).forEach(item => {
                if (item.type === 'meta') return;
                const qty = Number(item.cantidad || item.qty || item.quantity || 0);
                const uc  = item.historical_cost !== undefined ? Number(item.historical_cost) : (costMap.get(String(item.id)) || costMap.get(item.name) || 0);
                cost += qty * uc;
            });
            last7[key].sales += total;
            last7[key].costs += cost;
        });
        const labels    = keys.map(k => last7[k].label);
        const salesData = keys.map(k => last7[k].sales);
        const costsData = keys.map(k => last7[k].costs);

        if (salesChartInstance) {
            if (salesChartInstance.canvas !== canvas) { salesChartInstance.destroy(); salesChartInstance = null; }
            else {
                salesChartInstance.data.labels           = labels;
                salesChartInstance.data.datasets[0].data = salesData;
                salesChartInstance.data.datasets[1].data = costsData;
                salesChartInstance.update(); return;
            }
        }
        const ctx    = canvas.getContext('2d');
        const gSales = ctx.createLinearGradient(0, 0, 0, 280);
        gSales.addColorStop(0, 'rgba(116,167,255,.28)'); gSales.addColorStop(1, 'rgba(116,167,255,0)');
        const gCosts = ctx.createLinearGradient(0, 0, 0, 280);
        gCosts.addColorStop(0, 'rgba(228,108,117,.18)');  gCosts.addColorStop(1, 'rgba(228,108,117,0)');
        const maxValue      = Math.max(...salesData, ...costsData, 0);
        const yTickCallback = (v) => {
            if (maxValue >= 1000000) return `$${(v/1000000).toFixed(1)}M`;
            if (maxValue >= 10000)   return `$${(v/1000).toFixed(0)}k`;
            if (maxValue >= 1000)    return `$${(v/1000).toFixed(1)}k`;
            return `$${v.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
        };
        salesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'Lo que vendí',    data: salesData, borderColor:'#74a7ff', backgroundColor: gSales, borderWidth:3, tension:.38, fill:true, pointBackgroundColor:'#74a7ff', pointBorderColor:'#08111f', pointBorderWidth:2, pointRadius:3, pointHoverRadius:5 },
                    { label: 'Lo que me costó', data: costsData, borderColor:'#e48b92', backgroundColor: gCosts, borderWidth:2, borderDash:[6,5], tension:.38, fill:true, pointBackgroundColor:'#e48b92', pointBorderColor:'#08111f', pointBorderWidth:2, pointRadius:3 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode:'index', intersect:false },
                animation:   { duration:1400, easing:'easeOutQuart' },
                scales: {
                    y: {
                        beginAtZero:true,
                        grid:{ color:'rgba(148,163,184,.12)' },
                        ticks:{ maxTicksLimit:5, callback: yTickCallback, padding: 10, font:{ size: 12, weight: '500' } }
                    },
                    x: {
                        grid:{ display:false },
                        ticks:{ padding: 8, font:{ size: 12, weight: '500' } }
                    }
                },
                plugins: {
                    legend: { position:'top', align:'end', labels:{ usePointStyle: true, pointStyle: 'circle', boxWidth:10, boxHeight:10, padding:16, font:{ size:12, weight:'600' } } },
                    tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } }
                }
            }
        });
    }

    loadMetrics();
}
