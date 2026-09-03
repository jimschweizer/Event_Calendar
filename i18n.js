// i18n.js — every user-facing string for Aurora Events, in both supported
// languages. Loaded BEFORE app.js (plain script, no fetch). Canonical keys
// are English; internal identifiers (bucket names, raw categories, <option>
// values) never change — only display is translated.
//
// Dialect: es-MX-leaning Latin American Spanish (ustedes-form). Event
// content (titles/descriptions/venues) is source-owned and NEVER translated
// here. To add a string: add the key to BOTH language objects with identical
// English copy to today's UI text.
window.I18N = {
  en: {
    "meta.title": "Aurora Events — Local Events Calendar",
    "meta.description":
      "A privacy-first, serverless local events calendar for Aurora, IL, refreshed twice daily via GitHub Actions from a hybrid ICS/JSON-LD/HTML/API ingestion pipeline.",

    "brand.subtitle": "Local Events Calendar — Refreshed 6:17 AM & 5:23 PM CDT",
    "brand.beta": "(BETA - Under Construction)",
    "nav.propose": "Propose a Source",

    "theme.toggleAria": "Toggle dark/light theme",
    "lang.toggleAria": "Switch to Spanish",

    "panel.title": "Propose an Event Source",
    "panel.closeAria": "Close panel",
    "panel.urlLabel": "Source URL (calendar page, ICS feed, or RSS/Atom feed)",
    "panel.urlPlaceholder": "e.g. https://example.org/events/",
    "panel.venueLabel": "Venue / Organization Name",
    "panel.venuePlaceholder": "e.g. The Venue",
    "panel.typeLabel": "Source Type",
    "panel.categoryLabel": "Category",
    "type.html": "HTML Calendar Page",
    "type.jsonld": "JSON-LD Event Page",
    "type.ics": "ICS / iCal Feed",
    "type.rss": "RSS / Atom Feed",
    "btn.ghIssue": "Submit Issue on GitHub",
    "btn.ghPr": "1-Click PR (Edit sources.json)",
    "btn.localQueue": "Save in Browser Only",
    "btn.copyJson": "Copy JSON Snippet",
    "btn.copied": "Copied!",

    "controls.categoriesAria": "Event Categories",
    "tabs.all": "All Events",
    "search.placeholder": "Filter by keyword, venue, source...",
    "search.aria": "Filter events",
    "search.clearAria": "Clear filter",
    "status.loading": "Fetching latest events snapshot…",

    "featured.aria": "Featured event",
    "featured.badge": "FEATURED",
    "featured.desc":
      "After-dark nightlife at Quantum Prairie — the craft-cocktail lounge inside Two Brothers Roundhouse in downtown Aurora.",
    "featured.cta": "View listing on Eventbrite ↗",

    "bucket.Today": "Today",
    "bucket.Tomorrow": "Tomorrow",
    "bucket.This Week": "This Week",
    "bucket.Later": "Later",
    "bucket.Unconfirmed Date": "Unconfirmed Date",
    "section.count": { one: "1 event", other: "{count} events" },
    "overflow.more": "{count} more {bucket} events",

    "confidence.low": "Unconfirmed — verify at source",
    "confidence.medium": "Community-sourced",
    "event.via": "via {source}",
    "event.dateUnknown": "Date unknown",

    "queue.badge": "queued in browser",
    "queue.note":
      "Saved locally. Click 'Propose a Source' above to submit a GitHub Issue or PR to include it in official runs.",
    "queue.remove": "✕ Remove",
    "queue.heading": "Proposed Sources (pending review)",

    "empty.title": "No events found",
    "empty.hint": "Try clearing your filter or selecting another category tab.",

    "footer.refresh": "Last refresh: {date}",
    "footer.sourcesLive": " · {ok}/{total} sources live",
    "footer.pending": "Background data pending.",
    "footer.blurb":
      "Open source, zero-tracking local events calendar. A hybrid ICS/JSON-LD/HTML/API pipeline runs twice daily via GitHub Actions and commits results to static JSON.",
    "footer.repo": "GitHub Repository",
    "footer.sources": "View Data Sources",
    "footer.sponsor":
      "Sponsored by Global Data Sciences, Inc Aurora, IL - an Aurora company acting globally since 2007.",

    "alert.url": "Please enter a valid http(s) URL.",
    "alert.copied":
      'Copied JSON snippet for "{label}" to clipboard!\nOpening GitHub file editor...'
  },

  es: {
    "meta.title": "Aurora Events — Calendario de eventos locales",
    "meta.description":
      "Un calendario local de eventos de código abierto y sin rastreo para Aurora, IL, actualizado dos veces al día mediante GitHub Actions desde un proceso híbrido de ingesta ICS/JSON-LD/HTML/API.",

    "brand.subtitle": "Calendario de eventos locales — Actualizado 6:17 a. m. y 5:23 p. m. CDT",
    "brand.beta": "(BETA — En construcción)",
    "nav.propose": "Proponer una fuente",

    "theme.toggleAria": "Alternar tema oscuro/claro",
    "lang.toggleAria": "Cambiar a inglés",

    "panel.title": "Proponer una fuente de eventos",
    "panel.closeAria": "Cerrar panel",
    "panel.urlLabel": "URL de la fuente (página de calendario, feed ICS o feed RSS/Atom)",
    "panel.urlPlaceholder": "p. ej. https://example.org/events/",
    "panel.venueLabel": "Lugar / Nombre de la organización",
    "panel.venuePlaceholder": "p. ej. Paramount Theatre",
    "panel.typeLabel": "Tipo de fuente",
    "panel.categoryLabel": "Categoría",
    "type.html": "Página HTML de calendario",
    "type.jsonld": "Página de evento JSON-LD",
    "type.ics": "Feed ICS / iCal",
    "type.rss": "Feed RSS / Atom",
    "btn.ghIssue": "Enviar propuesta en GitHub",
    "btn.ghPr": "PR en 1 clic (Editar sources.json)",
    "btn.localQueue": "Guardar solo en el navegador",
    "btn.copyJson": "Copiar fragmento JSON",
    "btn.copied": "¡Copiado!",

    "controls.categoriesAria": "Categorías de eventos",
    "tabs.all": "Todos los eventos",
    "search.placeholder": "Filtrar por palabra clave, lugar, fuente...",
    "search.aria": "Filtrar eventos",
    "search.clearAria": "Borrar filtro",
    "status.loading": "Cargando los eventos más recientes…",

    "featured.aria": "Evento destacado",
    "featured.badge": "DESTACADO",
    "featured.desc":
      "Vida nocturna en Quantum Prairie, el lounge de cócteles artesanales dentro de Two Brothers Roundhouse, en el centro de Aurora.",
    "featured.cta": "Ver evento en Eventbrite ↗",

    "bucket.Today": "Hoy",
    "bucket.Tomorrow": "Mañana",
    "bucket.This Week": "Esta semana",
    "bucket.Later": "Más adelante",
    "bucket.Unconfirmed Date": "Fecha sin confirmar",
    "section.count": { one: "1 evento", other: "{count} eventos" },
    "overflow.more": "Ver {count} eventos más de {bucket}",

    "confidence.low": "Sin confirmar — verificar en la fuente",
    "confidence.medium": "Fuente comunitaria",
    "event.via": "vía {source}",
    "event.dateUnknown": "Fecha desconocida",

    "queue.badge": "guardado en el navegador",
    "queue.note":
      "Guardado localmente. Haz clic en «Proponer una fuente» para enviar un Issue o PR de GitHub e incluirlo en las ejecuciones oficiales.",
    "queue.remove": "✕ Quitar",
    "queue.heading": "Fuentes propuestas (en revisión)",

    "empty.title": "No se encontraron eventos",
    "empty.hint": "Prueba borrar el filtro o selecciona otra pestaña de categoría.",

    "footer.refresh": "Última actualización: {date}",
    "footer.sourcesLive": " · {ok}/{total} fuentes activas",
    "footer.pending": "Datos pendientes de carga.",
    "footer.blurb":
      "Calendario local de eventos de código abierto y sin rastreo. Un proceso híbrido ICS/JSON-LD/HTML/API se ejecuta dos veces al día mediante GitHub Actions y publica los resultados en JSON estático.",
    "footer.repo": "Repositorio de GitHub",
    "footer.sources": "Ver fuentes de datos",
    "footer.sponsor":
      "Patrocinado por Global Data Sciences, Inc., Aurora, IL: una empresa de Aurora que actúa globalmente desde 2007.",

    "alert.url": "Ingresa una URL http(s) válida.",
    "alert.copied":
      'Fragmento JSON de «{label}» copiado al portapapeles.\nAbriendo el editor de archivos de GitHub...',

    // Display labels for raw event-category values (tabs, badges, form
    // options). Unknown categories fall back to the raw English label via
    // catLabel(). English needs no map — raw values ARE the English labels.
    categories: {
      "Civic": "Cívico",
      "Civic Meetings": "Reuniones cívicas",
      "Club / Social": "Club / Social",
      "Commerce": "Comercio",
      "Community": "Comunidad",
      "Education": "Educación",
      "Entertainment": "Entretenimiento",
      "Faith": "Fe",
      "General": "General",
      "Live Music": "Música en vivo",
      "News Mentions": "Menciones en noticias",
      "Parks & Rec": "Parques y recreación",
      "Retail": "Comercio minorista"
    }
  }
};
