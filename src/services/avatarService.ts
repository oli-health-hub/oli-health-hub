/**
 * avatarService.ts
 *
 * Seleciona, comprime e faz upload da foto de perfil para o Supabase Storage.
 * Bucket: avatars (público) — path: {userId}/avatar.jpg
 *
 * Fontes suportadas:
 *   - Galeria do dispositivo (expo-image-picker)
 *   - Câmera do dispositivo  (expo-image-picker)
 *   - Foto da conta Google   (user_metadata.avatar_url via OAuth — futura integração)
 */

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';

const BUCKET       = 'avatars';
const MAX_DIMENSION = 400;   // px — redimensiona para no máx 400×400
const JPEG_QUALITY  = 0.85;  // 85% — boa qualidade, ~80-120 KB

export type AvatarSource = 'gallery' | 'camera';

// ── Permissões ────────────────────────────────────────────────────────────────

async function requestPermission(source: AvatarSource): Promise<boolean> {
  if (source === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  }
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

// ── Seleção de imagem ─────────────────────────────────────────────────────────

export async function pickAvatarImage(source: AvatarSource): Promise<string | null> {
  const hasPermission = await requestPermission(source);
  if (!hasPermission) return null;

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],      // força recorte quadrado
    quality: 1,           // qualidade máxima — comprimimos depois com ImageManipulator
  };

  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}

// ── Compressão ────────────────────────────────────────────────────────────────

async function compressImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION, height: MAX_DIMENSION } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

// ── Upload para Supabase Storage ──────────────────────────────────────────────

export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const compressed = await compressImage(localUri);

  // Lê o arquivo como ArrayBuffer para o upload
  const response  = await fetch(compressed);
  const arrayBuf  = await response.arrayBuffer();
  const uint8     = new Uint8Array(arrayBuf);

  const path = `${userId}/avatar.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, uint8, {
      contentType:  'image/jpeg',
      upsert:       true,          // substitui se já existir
    });

  if (uploadError) throw uploadError;

  // Retorna URL pública com cache-bust para forçar recarga
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

// ── Fluxo completo: pick → compress → upload → update profile ─────────────────

export async function updateProfileAvatar(
  userId: string,
  source: AvatarSource,
): Promise<string | null> {
  const localUri = await pickAvatarImage(source);
  if (!localUri) return null;

  const publicUrl = await uploadAvatar(userId, localUri);

  const { error } = await supabase
    .from('profiles')
    .update({ foto_url: publicUrl })
    .eq('id', userId);

  if (error) throw error;
  return publicUrl;
}

// ── Remove foto de perfil ─────────────────────────────────────────────────────

export async function removeProfileAvatar(userId: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([`${userId}/avatar.jpg`]);

  const { error } = await supabase
    .from('profiles')
    .update({ foto_url: null })
    .eq('id', userId);

  if (error) throw error;
}
