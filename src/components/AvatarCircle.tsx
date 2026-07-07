import { View, Text, Image } from 'react-native';
import { colors } from '../theme/designSystem';
import { getInitials, avatarColor } from '../utils/profileDisplay';

export function AvatarCircle({
  nome, fotoUrl, size,
}: {
  nome: string;
  fotoUrl?: string | null;
  size: number;
}) {
  const color    = avatarColor(nome);
  const initials = getInitials(nome);
  return fotoUrl ? (
    <Image
      source={{ uri: fotoUrl }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      accessibilityLabel={`Foto de ${nome}`}
    />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: size * 0.34, fontWeight: '700', color: colors.white }}>{initials}</Text>
    </View>
  );
}
