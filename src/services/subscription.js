// src/services/subscription.js

export function hasValidAccess(business) {
    if (!business || !business.subscription_status) {
        return false;
    }

    if (business.subscription_status === 'trialing') {
        return true;
    }

    const now = new Date();
    // Convertimos la fecha de Supabase a un objeto Date de JS
    const periodEnd = new Date(business.current_period_end);

    if (business.subscription_status === 'active' && periodEnd > now) {
        return true;
    }

    // Opcional: Si quieres dar 3 días de gracia
    const periodEndPlusGrace = new Date(periodEnd.getTime() + (3 * 24 * 60 * 60 * 1000));
    if (business.subscription_status === 'past_due' && periodEndPlusGrace > now) { return true; }

    return false;
}