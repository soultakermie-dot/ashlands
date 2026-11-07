// Матеріали рельєфу. Назви й extras.ashlands читає браузер (client/js/builder/terrainMaterials.js)
// і ставить замість простих кольорів фото-текстури.
export const MAT = { terrain: 0, soil: 1, rock: 2, bark: 3, foliage: 4, water: 5 };

export function materialList(bounds) {
  return [
    { name: 'ash_terrain', extras: { ashlands: 'terrain', splat: 'splat.png', bounds } },
    { name: 'ash_soil', extras: { ashlands: 'soil' } },
    { name: 'ash_rock', extras: { ashlands: 'rock' } },
    { name: 'ash_bark', extras: { ashlands: 'bark' } },
    { name: 'ash_foliage', extras: { ashlands: 'foliage' }, doubleSided: true },
    { name: 'ash_water', extras: { ashlands: 'water' }, color: [0.1, 0.16, 0.17, 0.85], roughness: 0.1 },
  ];
}
