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
  1: [require('../../assets/room-photos/sala-1.jpg')],
  2: [require('../../assets/room-photos/sala-2.jpg')],
  6: [require('../../assets/room-photos/sala-6.jpg')],
};

/** Retorna as fotos de uma sala (vazio se não houver). */
export function getRoomPhotos(roomId: number): ImageSourcePropType[] {
  return ROOM_PHOTOS[roomId] ?? [];
}

/** Primeira foto da sala, ou undefined. Usada na miniatura do card. */
export function getRoomCover(roomId: number): ImageSourcePropType | undefined {
  return ROOM_PHOTOS[roomId]?.[0];
}
