import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/designSystem';

const MAX_TAGS = 5;
const MAX_TAG_LENGTH = 30;

export function TagInput({
  tags, onChange, placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  function addTag() {
    const value = draft.trim();
    if (!value || tags.length >= MAX_TAGS || tags.includes(value)) return;
    onChange([...tags, value]);
    setDraft('');
  }

  function removeTag(tag: string) {
    onChange(tags.filter(t => t !== tag));
  }

  return (
    <View>
      <View style={styles.chipWrap}>
        {tags.map(tag => (
          <View key={tag} style={styles.chip}>
            <Text style={styles.chipText}>{tag}</Text>
            <TouchableOpacity onPress={() => removeTag(tag)} accessibilityLabel={`Remover ${tag}`} hitSlop={6}>
              <Ionicons name="close" size={12} color={colors.oliGreen} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
      {tags.length < MAX_TAGS && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder ?? 'Adicionar…'}
            placeholderTextColor={colors.oliLightGray}
            maxLength={MAX_TAG_LENGTH}
            onSubmitEditing={addTag}
            returnKeyType="done"
            accessibilityLabel="Nova subespecialidade"
          />
          <TouchableOpacity
            style={[styles.addBtn, !draft.trim() && styles.addBtnDisabled]}
            onPress={addTag}
            disabled={!draft.trim()}
            accessibilityLabel="Adicionar tag"
          >
            <Ionicons name="add" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chipWrap: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           6,
    marginBottom:  spacing.sm,
  },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   `${colors.oliGreen}12`,
    borderRadius:      radius.full,
    paddingHorizontal: 10,
    paddingVertical:   5,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.oliGreen },
  inputRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
    alignItems:    'center',
  },
  input: {
    flex:              1,
    fontSize:          13,
    color:             colors.oliDarkGray,
    borderWidth:       1,
    borderColor:       colors.border,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   8,
  },
  addBtn: {
    width:            32,
    height:           32,
    borderRadius:     16,
    backgroundColor:  colors.oliGreen,
    justifyContent:   'center',
    alignItems:       'center',
  },
  addBtnDisabled: { opacity: 0.4 },
});
