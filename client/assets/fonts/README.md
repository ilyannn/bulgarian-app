# Ysabeau Font Files

Place the Ysabeau font files in this directory for Bulgarian typography support.

## Required Files

Download from [Ysabeau on Google Fonts](https://fonts.google.com/specimen/Ysabeau) or [Catharsis Fonts](https://fonts.catharsisweb.com/ysabeau/):

- `Ysabeau[wght].woff2` (variable weight version)
- Or individual weight files like:
  - `Ysabeau-Regular.woff2`
  - `Ysabeau-Medium.woff2`
  - `Ysabeau-Bold.woff2`

## Font Features

Ysabeau includes:
- Complete Cyrillic support
- Bulgarian-specific glyph variants
- OpenType features for localization
- Variable font capabilities

## Usage

The font is referenced in the CSS with:
```css
font-family: "Ysabeau", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
```

Bulgarian text should use the `.bg-text` class or `:lang(bg)` selector for proper rendering.