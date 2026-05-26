class Locale {
    static lang = (window.__LOCALE_LANG__ ?? 'en');
    static data = (window.__LOCALES__ ?? {})[Locale.lang] ?? {};

    static at(key) {
        return Locale.data[key] ?? key;
    }

    static applyAll() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = Locale.at(el.dataset.i18n);
        });
    }

    static setLang(lang) {
        const all = window.__LOCALES__ ?? {};
        if (!all[lang]) { return; }
        Locale.lang = lang;
        Locale.data = all[lang];
        document.documentElement.lang = lang;
        Locale.applyAll();
    }
}
