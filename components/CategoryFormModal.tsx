import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Category } from '../types';
import {
  addCategory,
  updateCategory,
  removeCategory,
  countExpensesInCategory,
} from '../database/database';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '../constants/categories';
import { useCategories } from '../hooks/useCategories';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { ThemePalette, RADIUS, SPACING, alpha, categoryColor } from '../constants/theme';
import { Label, PrimaryButton, GhostButton } from './ui';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Recebe a chave da categoria criada, para já deixá-la selecionada. */
  onSaved?: (key: string) => void;
  editing?: Category;
}

export default function CategoryFormModal({ visible, onClose, onSaved, editing }: Props) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { reload } = useCategories();

  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState(CATEGORY_ICONS[0]);
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setLabel(editing.label);
      setIcon(editing.icon);
      setColor(editing.color);
    } else {
      setLabel('');
      setIcon(CATEGORY_ICONS[0]);
      setColor(CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)]);
    }
  }, [visible, editing]);

  const salvar = async () => {
    const nome = label.trim();
    if (!nome) {
      Alert.alert('Falta o nome', 'Dê um nome para a categoria.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.key, nome, icon, color);
        await reload();
        onSaved?.(editing.key);
      } else {
        const key = await addCategory(nome, icon, color);
        await reload();
        onSaved?.(key);
      }
      onClose();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a categoria.');
    } finally {
      setSaving(false);
    }
  };

  const excluir = async () => {
    if (!editing) return;
    const emUso = await countExpensesInCategory(editing.key);
    const original = editing.is_builtin === 1;

    const mensagem = original
      ? 'Categorias originais não podem ser excluídas, mas podem sair da lista de escolha. Os lançamentos que já usam ela continuam como estão.'
      : emUso > 0
        ? `${emUso} ${emUso === 1 ? 'lançamento usa' : 'lançamentos usam'} esta categoria. Ela sai da lista de escolha, mas continua rotulando o histórico.`
        : 'Nenhum lançamento usa esta categoria. Ela será excluída de vez.';

    Alert.alert(original || emUso > 0 ? 'Ocultar categoria' : 'Excluir categoria', mensagem, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: original || emUso > 0 ? 'Ocultar' : 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await removeCategory(editing.key);
          await reload();
          onClose();
        },
      },
    ]);
  };

  const tint = categoryColor(color, theme);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={[styles.preview, { backgroundColor: alpha(tint, 0.14) }]}>
              <MaterialCommunityIcons name={icon as never} size={22} color={tint} />
            </View>
            <Text style={styles.title}>
              {editing ? 'Editar categoria' : 'Nova categoria'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={8} style={{ padding: 4 }}>
              <MaterialCommunityIcons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Label>Nome</Label>
            <TextInput
              style={styles.input}
              placeholder="Pet, Igreja, Filhos, Assinaturas..."
              placeholderTextColor={theme.textLight}
              value={label}
              onChangeText={setLabel}
              autoFocus={!editing}
            />

            <Label style={styles.spaced}>Ícone</Label>
            <View style={styles.grid}>
              {CATEGORY_ICONS.map((ic) => {
                const ativo = ic === icon;
                return (
                  <TouchableOpacity
                    key={ic}
                    style={[
                      styles.iconItem,
                      ativo && { borderColor: tint, backgroundColor: alpha(tint, 0.12) },
                    ]}
                    onPress={() => setIcon(ic)}
                  >
                    <MaterialCommunityIcons
                      name={ic as never}
                      size={20}
                      color={ativo ? tint : theme.textLight}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <Label style={styles.spaced}>Cor</Label>
            <View style={styles.colorRow}>
              {CATEGORY_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorItem,
                    { backgroundColor: categoryColor(c, theme) },
                    c === color && styles.colorItemActive,
                  ]}
                  onPress={() => setColor(c)}
                >
                  {c === color && (
                    <MaterialCommunityIcons name="check" size={15} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <PrimaryButton
              label={editing ? 'Salvar' : 'Criar categoria'}
              icon="check"
              onPress={salvar}
              loading={saving}
              color={tint}
              style={{ marginTop: SPACING.xl }}
            />

            {!!editing && (
              <GhostButton
                label={editing.is_builtin === 1 ? 'Ocultar da lista' : 'Excluir categoria'}
                icon="trash-can-outline"
                color={theme.danger}
                onPress={excluir}
                style={{ marginTop: SPACING.md, marginBottom: SPACING.lg }}
              />
            )}
            {!editing && <View style={{ height: SPACING.xl }} />}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (t: ThemePalette) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: t.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: t.surface,
      borderTopLeftRadius: RADIUS.xl + 4,
      borderTopRightRadius: RADIUS.xl + 4,
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.md,
      maxHeight: '90%',
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: t.borderStrong,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: SPACING.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginBottom: SPACING.lg,
    },
    preview: {
      width: 40,
      height: 40,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { flex: 1, fontSize: 19, fontWeight: '700', color: t.text, letterSpacing: -0.3 },
    spaced: { marginTop: SPACING.lg },
    input: {
      backgroundColor: t.surfaceAlt,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.lg,
      paddingVertical: 14,
      fontSize: 15.5,
      color: t.text,
      borderWidth: 1,
      borderColor: t.border,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    iconItem: {
      width: 46,
      height: 44,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
    colorItem: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorItemActive: { borderWidth: 2, borderColor: t.text },
  });
