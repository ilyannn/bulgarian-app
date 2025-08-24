# Bulgarian Voice Coach — Build Plan (Justfile edition)

> **⚠️ This document has been reorganized for better project management:**
>
> - **✅ Completed items** → See [DONE.md](./DONE.md)
> - **📋 Remaining tasks** → See [TODO.md](./TODO.md)

This document now contains only the core reference materials and data structures.

---

## Core Data Structures

### Grammar Item Structure

```json
{
  "id": "bg.no_infinitive.da_present",
  "title_bg": "Няма инфинитив: 'да' + сегашно",
  "level": ["A2", "B1"],
  "micro_explanation_bg": "В български няма инфинитив. Използваме 'да' + сегашно: 'Искам да поръчам'.",
  "contrast_notes": {
    "PL": "Polish uses infinitive: chcę zamówić",
    "RU": "Russian uses infinitive: хочу заказать",
    "UK": "Ukrainian uses infinitive: хочу замовити",
    "SR": "Serbian uses da + present: hoću da naručim"
  },
  "examples": [{ "wrong": "Искам поръчвам кафе.", "right": "Искам да поръчам кафе." }],
  "drills": [
    { "type": "transform", "prompt_bg": "Искам ___ (поръчвам) кафе.", "answer_bg": "да поръчам" }
  ],
  "srs": { "interval_days": [1, 3, 7, 21] },
  "triggers": ["infinitive_like_pattern", "modal_verb_bare_infinitive"]
}
```

### Scenario Binding Structure

```json
{
  "id": "a2_cafe_ordering",
  "title": "В кафене: поръчка",
  "description": "Practice ordering food and drinks in Bulgarian",
  "level": "A2",
  "grammar_binding": {
    "primary": ["bg.no_infinitive.da_present", "bg.definite.article.postposed"],
    "secondary": ["bg.future.shte", "bg.clitics.position"],
    "binding_method": "auto-heuristic-v1"
  },
  "dialogue": [
    { "speaker": "waiter", "text": "Добро утро! Какво ще желаете?" },
    { "speaker": "customer", "text": "Искам да поръчам салата, моля." }
  ]
}
```

### CoachResponse Structure

```json
{
  "reply_bg": "Добре казано! Но има една малка грешка.",
  "corrections": [
    {
      "type": "infinitive_usage",
      "before": "искам поръчвам",
      "after": "искам да поръчам",
      "note": "В български използваме 'да' + сегашно вместо инфинитив",
      "error_tag": "bg.no_infinitive.da_present"
    }
  ],
  "contrastive_note": "За разлика от полски (chcę zamówić), българският използва конструкция с 'да'",
  "drills": [
    {
      "type": "transform",
      "prompt_bg": "Мога ___ (идвам) утре.",
      "answer_bg": "да дойда"
    }
  ]
}
```

## Bulgarian Typography CSS

```css
/* Bulgarian font face (self-hosted) */
@font-face {
  font-family: 'Ysabeau';
  src: url('/assets/fonts/Ysabeau[wght].woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0400-04FF, U+0500-052F; /* Cyrillic + Extended */
}

/* Bulgarian language spans with proper glyph forms */
:lang(bg) {
  font-family:
    'Ysabeau',
    system-ui,
    -apple-system,
    Segoe UI,
    Roboto,
    Helvetica,
    Arial,
    sans-serif;
  font-feature-settings: 'locl' 1; /* enable local language forms */
}

/* Explicit class for Bulgarian content */
.bg-text {
  font-family:
    'Ysabeau',
    system-ui,
    -apple-system,
    Segoe UI,
    Roboto,
    Helvetica,
    Arial,
    sans-serif;
  font-feature-settings: 'locl' 1;
}
```

## Performance Targets

- **End-to-end latency**: 1.2–2.0 seconds
  - Audio frames: 20–40ms
  - VAD tail: 200–400ms
  - ASR processing: 0.5–1.0s
  - TTS generation: ~0.2s

## Content File Locations

- `server/content/bg_grammar_pack.json` — Grammar rules and drills
- `server/content/bg_scenarios_with_grammar.json` — Conversational scenarios
- `client/assets/fonts/` — Ysabeau font files for Bulgarian typography

---

For implementation status and remaining work, see:

- ✅ **[DONE.md](./DONE.md)** — What's been implemented
- 📋 **[TODO.md](./TODO.md)** — What needs to be done
