# Ysabeau Font Files

Bulgarian typography support using the Ysabeau font family with full Cyrillic support.

## Current Files

- `Ysabeau-VariableFont_wght.ttf` - Variable weight font (100-900)
- `Ysabeau-Italic-VariableFont_wght.ttf` - Variable weight italic font (100-900)
- `OFL.txt` - Open Font License

## Features

Ysabeau includes:
- Full Cyrillic support including Bulgarian-specific glyphs
- Variable font technology for all weights (100-900)
- Designed specifically for multi-script typography
- OpenType features for proper Bulgarian text rendering

## Font Configuration

Fonts are configured in `index.html`:
```css
@font-face {
  font-family: "Ysabeau";
  src: url("/assets/fonts/Ysabeau-VariableFont_wght.ttf") format("truetype");
  font-weight: 100 900;
  font-style: normal;
  unicode-range: U+0400-04FF, U+0500-052F; /* Cyrillic */
}

:lang(bg) {
  font-family: "Ysabeau", system-ui, -apple-system, sans-serif;
  font-feature-settings: "locl" 1; /* Bulgarian localization */
}
```

## License

Licensed under the SIL Open Font License 1.1 (see OFL.txt)