import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { COLORS } from '../../constants/colors';
import { exportAllData, importAllData } from '../../database/database';

const SAVE_TIPS = [
  {
    icon: 'google-drive',
    color: '#4285F4',
    title: 'Google Drive',
    steps: [
      'Toque em "Baixar meus dados" abaixo.',
      'No menu de compartilhamento escolha Google Drive.',
      'Salve o arquivo na sua conta Google.',
      'Para restaurar: abra o arquivo do Drive, copie o conteúdo e cole em "Importar dados".',
    ],
  },
  {
    icon: 'email-outline',
    color: '#EA4335',
    title: 'E-mail para si mesmo',
    steps: [
      'Toque em "Baixar meus dados".',
      'Escolha seu aplicativo de e-mail e envie para o seu próprio endereço.',
      'O e-mail fica salvo na sua caixa de entrada indefinidamente.',
      'Para restaurar: abra o e-mail, copie o texto do anexo/mensagem e cole em "Importar dados".',
    ],
  },
  {
    icon: 'whatsapp',
    color: '#25D366',
    title: 'WhatsApp (Mensagens Salvas)',
    steps: [
      'Toque em "Baixar meus dados".',
      'Compartilhe via WhatsApp — procure por "Você" ou sua própria conversa.',
      'A mensagem fica salva no seu WhatsApp como anotação.',
      'Para restaurar: copie o texto da mensagem e cole em "Importar dados".',
    ],
  },
];

// Modal de importação definido fora para não perder foco ao digitar
function ImportModal({
  visible,
  onClose,
  onConfirm,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (text: string) => void;
  loading: boolean;
}) {
  const [text, setText] = useState('');
  const [picking, setPicking] = useState(false);

  const handleClose = () => {
    setText('');
    onClose();
  };

  const handlePickFile = async () => {
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.uri) {
        Alert.alert('Erro', 'Não foi possível acessar o arquivo.');
        return;
      }

      const content = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      setText(content);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível ler o arquivo selecionado.');
    } finally {
      setPicking(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <View style={modal.header}>
            <Text style={modal.title}>Importar Dados</Text>
            <TouchableOpacity onPress={handleClose}>
              <MaterialCommunityIcons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={modal.hint}>
            Selecione o arquivo de backup (.txt ou .json) ou cole o conteúdo abaixo:
          </Text>

          {/* Botão de selecionar arquivo */}
          <TouchableOpacity
            style={[modal.fileBtn, picking && { opacity: 0.6 }]}
            onPress={handlePickFile}
            disabled={picking}
          >
            {picking ? (
              <ActivityIndicator color={COLORS.highlight} size="small" />
            ) : (
              <MaterialCommunityIcons name="file-search-outline" size={20} color={COLORS.highlight} />
            )}
            <Text style={modal.fileBtnText}>
              {picking ? 'Abrindo...' : 'Procurar arquivo no celular'}
            </Text>
          </TouchableOpacity>

          <View style={modal.dividerRow}>
            <View style={modal.dividerLine} />
            <Text style={modal.dividerText}>ou cole o texto</Text>
            <View style={modal.dividerLine} />
          </View>

          <TextInput
            style={modal.input}
            value={text}
            onChangeText={setText}
            placeholder='{"version": 1, "exportedAt": "...", ...}'
            placeholderTextColor={COLORS.textLight}
            multiline
            textAlignVertical="top"
            autoCorrect={false}
            autoCapitalize="none"
          />

          <View style={modal.actions}>
            <TouchableOpacity style={modal.cancelBtn} onPress={handleClose}>
              <Text style={modal.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modal.confirmBtn, (!text.trim() || loading) && { opacity: 0.5 }]}
              onPress={() => onConfirm(text)}
              disabled={!text.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons name="database-import" size={18} color="#fff" />
                  <Text style={modal.confirmText}>Restaurar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function DadosScreen() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const json = await exportAllData();
      await Share.share({
        message: json,
        title: 'DividaZero — Backup de dados',
      });
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        Alert.alert('Erro', 'Não foi possível exportar os dados.');
      }
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (text: string) => {
    Alert.alert(
      'Atenção — isso substituirá tudo',
      'Todos os seus dados atuais serão apagados e substituídos pelo backup. Tem certeza?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim, restaurar',
          style: 'destructive',
          onPress: async () => {
            setImporting(true);
            try {
              await importAllData(text);
              setShowImport(false);
              Alert.alert('Sucesso!', 'Dados restaurados com sucesso. Reinicie o app para ver tudo atualizado.');
            } catch (e: any) {
              Alert.alert('Erro ao importar', e?.message ?? 'Arquivo inválido ou corrompido.');
            } finally {
              setImporting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Aviso principal */}
        <View style={styles.warningCard}>
          <MaterialCommunityIcons name="alert-circle" size={28} color="#fff" />
          <View style={styles.warningText}>
            <Text style={styles.warningTitle}>Seus dados ficam só no celular</Text>
            <Text style={styles.warningBody}>
              O DividaZero não envia nada para a internet. Todos os seus registros ficam
              armazenados localmente no aparelho.{'\n\n'}
              Se você <Text style={{ fontWeight: '800' }}>deletar o app</Text> ou{' '}
              <Text style={{ fontWeight: '800' }}>formatar o celular</Text> sem fazer um
              backup, <Text style={{ fontWeight: '800' }}>perderá todos os dados permanentemente.</Text>
            </Text>
          </View>
        </View>

        {/* Ações */}
        <View style={styles.actionsCard}>
          <Text style={styles.sectionLabel}>Backup e Restauração</Text>

          <TouchableOpacity
            style={[styles.actionBtn, styles.exportBtn]}
            onPress={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <MaterialCommunityIcons name="database-export" size={22} color="#fff" />
            )}
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>Baixar meus dados</Text>
              <Text style={styles.actionSub}>Exporta tudo em formato JSON</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.importBtn]}
            onPress={() => setShowImport(true)}
          >
            <MaterialCommunityIcons name="database-import" size={22} color={COLORS.highlight} />
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: COLORS.text }]}>Importar dados</Text>
              <Text style={styles.actionSub}>Restaura um backup anterior</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>

        {/* Guia: 3 formas de salvar */}
        <Text style={styles.sectionLabel}>3 formas de guardar seu backup</Text>

        {SAVE_TIPS.map((tip) => (
          <View key={tip.title} style={styles.tipCard}>
            <View style={[styles.tipIconBg, { backgroundColor: `${tip.color}18` }]}>
              <MaterialCommunityIcons name={tip.icon as never} size={26} color={tip.color} />
            </View>
            <View style={styles.tipBody}>
              <Text style={[styles.tipTitle, { color: tip.color }]}>{tip.title}</Text>
              {tip.steps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={[styles.stepNum, { backgroundColor: `${tip.color}22` }]}>
                    <Text style={[styles.stepNumText, { color: tip.color }]}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Dica final */}
        <View style={styles.infoBox}>
          <MaterialCommunityIcons name="lightbulb-outline" size={18} color={COLORS.warning} />
          <Text style={styles.infoText}>
            <Text style={{ fontWeight: '700' }}>Dica:</Text> faça um backup toda vez que registrar um
            empréstimo importante ou antes de atualizar o app.
          </Text>
        </View>
      </ScrollView>

      <ImportModal
        visible={showImport}
        onClose={() => setShowImport(false)}
        onConfirm={handleImport}
        loading={importing}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: COLORS.error,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
  },
  warningBody: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
  actionsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  exportBtn: {
    backgroundColor: COLORS.highlight,
  },
  importBtn: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  actionSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  tipCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  tipIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  tipBody: {
    gap: 10,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  stepNumText: {
    fontSize: 12,
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: `${COLORS.warning}18`,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
    marginTop: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 19,
  },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  hint: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
    lineHeight: 19,
  },
  fileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: COLORS.highlight,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginBottom: 12,
    backgroundColor: `${COLORS.highlight}0D`,
  },
  fileBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.highlight,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    fontSize: 12,
    color: COLORS.text,
    height: 220,
    fontFamily: 'monospace',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: COLORS.highlight,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
