import type { ImageSourcePropType } from 'react-native';

/**
 * Fotos das salas — empacotadas no app (servidas via OTA em updates).
 *
 * Metro exige `require()` com caminho literal, então o mapa é estático por
 * id de sala. Salas sem foto caem no placeholder ("Fotos em breve").
 * Para adicionar/trocar: solte o arquivo em assets/room-photos/, registre
 * aqui e rode `eas update` (não precisa rebuild nativo).
 */
const ROOM_PHOTOS: Record<number, ImageSourcePropType[]> = {
  // Refotografia em andamento (jun/26) — registrar id → foto(s) conforme chegam.
  // Ordem nova: 1 Vídeo Conf · 2 Psicologia · 3/5/6/7 Clínica · 4 Audio Visual ·
  // 8 Ginecologia/Estética · 9 Eventos. Cover = 1ª foto (vista da mesa).
  1: [
    require('../../assets/room-photos/sala-1.jpg'),
    require('../../assets/room-photos/sala-1b.jpg'),
  ],
  2: [require('../../assets/room-photos/sala-2.jpg')],
  4: [require('../../assets/room-photos/sala-4.jpg')],
  3: [
    require('../../assets/room-photos/sala-3.jpg'),
    require('../../assets/room-photos/sala-3b.jpg'),
  ],
  5: [
    require('../../assets/room-photos/sala-5.jpg'),
    require('../../assets/room-photos/sala-5b.jpg'),
  ],
  6: [
    require('../../assets/room-photos/sala-6.jpg'),
    require('../../assets/room-photos/sala-6b.jpg'),
  ],
  7: [
    require('../../assets/room-photos/sala-7.jpg'),
    require('../../assets/room-photos/sala-7b.jpg'),
  ],
  8: [
    require('../../assets/room-photos/sala-8.jpg'),
    require('../../assets/room-photos/sala-8b.jpg'),
    require('../../assets/room-photos/sala-8c.jpg'),
  ],
  9: [
    require('../../assets/room-photos/sala-9.jpg'),
    require('../../assets/room-photos/sala-9b.jpg'),
    require('../../assets/room-photos/sala-9c.jpg'),
  ],
};

/** Retorna as fotos de uma sala (vazio se não houver). */
export function getRoomPhotos(roomId: number): ImageSourcePropType[] {
  return ROOM_PHOTOS[roomId] ?? [];
}

/** Primeira foto da sala, ou undefined. Usada na miniatura do card. */
export function getRoomCover(roomId: number): ImageSourcePropType | undefined {
  return ROOM_PHOTOS[roomId]?.[0];
}
