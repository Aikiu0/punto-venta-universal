// src/services/theme.js

export const ThemeService = {
  // Clave para guardar en LocalStorage (Memoria del navegador)
  STORAGE_KEY: 'ferreteria_theme',

  init() {
    // 1. Verificar si ya hay preferencia guardada
    const savedTheme = localStorage.getItem(this.STORAGE_KEY);

    if (savedTheme) {
      this.applyTheme(savedTheme);
    } else {
      // 2. Si no, detectar preferencia del sistema operativo
      const userPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.applyTheme(userPrefersDark ? 'dark' : 'light');
    }
  },

  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
  },

  applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.setAttribute('data-theme', 'dark');
    } else {
      html.removeAttribute('data-theme');
    }
    localStorage.setItem(this.STORAGE_KEY, theme);
  }
};