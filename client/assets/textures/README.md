# Текстури рельєфу

Фото-текстури (1K, колір + нормалі) — з [Poly Haven](https://polyhaven.com), ліцензія **CC0** (можна вільно використовувати, без вказання автора).

| Файл | Що це | Poly Haven |
|---|---|---|
| `grass_*` | трава | grass_ground |
| `cobble_*` | бруківка | cobblestone_05 |
| `dirt_*` | земля з листям (ліс, береги) | brown_mud_leaves_01 |
| `cliff_*` | скелі | lichen_rock |
| `rock_*` | каміння, стінки, міст | mossy_rock |
| `bark_*` | кора дерев | pine_bark |
| `water_nor.jpg` | рябизна води | з прикладів three.js (MIT) |
| `foliage.png` | листя й хвоя | генерується: `npm run make-terrains` |

`*_diff.jpg` — колір, `*_nor.jpg` — нормалі (OpenGL). Як вони змішуються — `client/js/builder/terrainMaterials.js`.
