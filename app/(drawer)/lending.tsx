import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { ThemePalette, alpha } from '../../constants/theme';
import { LoanPerson } from '../../types';
import {
  getAllLoanPersons,
  deleteLoanPerson,
  markInstallmentPaid,
  getLoanPerson,
} from '../../database/database';
import { schedulePaymentNotification } from '../../hooks/useNotifications';
import { openWhatsAppCollection } from '../../utils/whatsapp';
import { calculateLoanInstallment } from '../../utils/calculations';
import { formatCurrency, formatPhone, getMonthName } from '../../utils/formatting';
import AddLoanModal from '../../components/AddLoanModal';
import LoanPersonCard from '../../components/LoanPersonCard';

export default function LendingScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [persons, setPersons] = useState<LoanPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<LoanPerson | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPaidOnly, setShowPaidOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllLoanPersons();
      setPersons(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const activeLoanPersons = persons.filter(
    (p) => !showPaidOnly ? p.installments_paid < p.installments : p.installments_paid >= p.installments
  );

  const totalActive = persons
    .filter((p) => p.installments_paid < p.installments)
    .reduce((sum, p) => {
      const inst = calculateLoanInstallment(p.total_amount, p.monthly_interest, p.installments);
      return sum + inst * (p.installments - p.installments_paid);
    }, 0);

  const handleCharge = async (person: LoanPerson) => {
    const inst = calculateLoanInstallment(
      person.total_amount,
      person.monthly_interest,
      person.installments
    );
    const today = new Date();
    const dueDate = `${person.payment_day}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    await openWhatsAppCollection(
      person.name,
      person.phone,
      inst,
      dueDate,
      person.installments_paid + 1,
      person.installments
    );
  };

  const handleMarkPaid = async (person: LoanPerson) => {
    Alert.alert(
      'Confirmar Pagamento',
      `Marcar parcela ${person.installments_paid + 1}/${person.installments} de ${person.name} como paga?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            await markInstallmentPaid(person.id);
            // Reschedule notification for next month
            const updated = await getLoanPerson(person.id);
            if (updated && updated.installments_paid < updated.installments) {
              await schedulePaymentNotification(updated);
            }
            load();
          },
        },
      ]
    );
  };

  const handleDelete = (person: LoanPerson) => {
    Alert.alert(
      'Excluir Empréstimo',
      `Remover ${person.name} da agenda de cobranças?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteLoanPerson(person.id);
            setShowDetailModal(false);
            load();
          },
        },
      ]
    );
  };

  const openDetail = (person: LoanPerson) => {
    setSelectedPerson(person);
    setShowDetailModal(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {/* Summary Banner */}
        <View style={styles.banner}>
          <View>
            <Text style={styles.bannerLabel}>A Receber (Restante)</Text>
            <Text style={styles.bannerValue}>{formatCurrency(totalActive)}</Text>
          </View>
          <View style={styles.bannerStats}>
            <Text style={styles.bannerStatValue}>
              {persons.filter((p) => p.installments_paid < p.installments).length}
            </Text>
            <Text style={styles.bannerStatLabel}>Ativos</Text>
          </View>
        </View>

        {/* Filter Toggle */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>
            {showPaidOnly ? 'Empréstimos Quitados' : 'Empréstimos Ativos'}
          </Text>
          <TouchableOpacity
            style={styles.filterToggle}
            onPress={() => setShowPaidOnly(!showPaidOnly)}
          >
            <Text style={styles.filterToggleText}>
              {showPaidOnly ? 'Ver ativos' : 'Ver quitados'}
            </Text>
          </TouchableOpacity>
        </View>

        {activeLoanPersons.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="account-cash" size={56} color={theme.textLight} />
            <Text style={styles.emptyText}>
              {showPaidOnly ? 'Nenhum empréstimo quitado' : 'Nenhum empréstimo ativo'}
            </Text>
            {!showPaidOnly && (
              <Text style={styles.emptySubtext}>
                Toque no + para registrar um empréstimo
              </Text>
            )}
          </View>
        ) : (
          activeLoanPersons.map((person) => (
            <LoanPersonCard
              key={person.id}
              person={person}
              onPress={() => openDetail(person)}
              onCharge={() => handleCharge(person)}
            />
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Modal */}
      <AddLoanModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={load}
      />

      {/* Detail Modal */}
      {selectedPerson && (
        <Modal
          visible={showDetailModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDetailModal(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.detailSheet}>
              <View style={styles.handle} />

              {/* Avatar + Name */}
              <View style={styles.detailHeader}>
                <View style={styles.detailAvatar}>
                  <Text style={styles.detailAvatarText}>
                    {selectedPerson.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.detailHeaderText}>
                  <Text style={styles.detailName}>{selectedPerson.name}</Text>
                  <Text style={styles.detailPhone}>{formatPhone(selectedPerson.phone)}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowDetailModal(false)}
                  style={styles.closeBtn}
                >
                  <MaterialCommunityIcons name="close" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Stats */}
                <View style={styles.detailStatsRow}>
                  <View style={styles.detailStat}>
                    <Text style={styles.detailStatLabel}>Valor Total</Text>
                    <Text style={styles.detailStatValue}>
                      {formatCurrency(selectedPerson.total_amount)}
                    </Text>
                  </View>
                  <View style={styles.detailStat}>
                    <Text style={styles.detailStatLabel}>Juros/mês</Text>
                    <Text style={[styles.detailStatValue, { color: theme.warning }]}>
                      {selectedPerson.monthly_interest}%
                    </Text>
                  </View>
                  <View style={styles.detailStat}>
                    <Text style={styles.detailStatLabel}>Parcela</Text>
                    <Text style={[styles.detailStatValue, { color: theme.primary }]}>
                      {formatCurrency(
                        calculateLoanInstallment(
                          selectedPerson.total_amount,
                          selectedPerson.monthly_interest,
                          selectedPerson.installments
                        )
                      )}
                    </Text>
                  </View>
                </View>

                {/* Progress */}
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressTitle}>
                      Progresso das Parcelas
                    </Text>
                    <Text style={styles.progressCount}>
                      {selectedPerson.installments_paid}/{selectedPerson.installments}
                    </Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${(selectedPerson.installments_paid / selectedPerson.installments) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Payment Day */}
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="calendar" size={18} color={theme.info} />
                  <Text style={styles.infoText}>
                    Vence todo dia {selectedPerson.payment_day} do mês
                  </Text>
                </View>

                {selectedPerson.notes ? (
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="note-text" size={18} color={theme.textSecondary} />
                    <Text style={styles.infoText}>{selectedPerson.notes}</Text>
                  </View>
                ) : null}

                {/* Actions */}
                {selectedPerson.installments_paid < selectedPerson.installments && (
                  <>
                    <TouchableOpacity
                      style={styles.whatsappBtn}
                      onPress={() => handleCharge(selectedPerson)}
                    >
                      <MaterialCommunityIcons name="whatsapp" size={20} color="#fff" />
                      <Text style={styles.whatsappBtnText}>Cobrar via WhatsApp</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.paidBtn}
                      onPress={() => handleMarkPaid(selectedPerson)}
                    >
                      <MaterialCommunityIcons name="check" size={20} color="#fff" />
                      <Text style={styles.paidBtnText}>Confirmar Pagamento da Parcela</Text>
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(selectedPerson)}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.danger} />
                  <Text style={styles.deleteBtnText}>Excluir Registro</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (t: ThemePalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background },
  content: { padding: 16, paddingBottom: 100 },
  banner: {
    backgroundColor: t.primaryFill,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500', marginBottom: 4 },
  bannerValue: { color: '#fff', fontSize: 26, fontWeight: '800' },
  bannerStats: { alignItems: 'center' },
  bannerStatValue: { color: '#fff', fontSize: 28, fontWeight: '900' },
  bannerStatLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  filterLabel: { fontSize: 16, fontWeight: '700', color: t.text },
  filterToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: alpha(t.info, 0.08),
    borderWidth: 1,
    borderColor: alpha(t.info, 0.25),
  },
  filterToggleText: { fontSize: 12, color: t.info, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 16, fontWeight: '600', color: t.textSecondary },
  emptySubtext: { fontSize: 13, color: t.textLight },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: t.primaryFill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: t.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  detailSheet: {
    backgroundColor: t.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: t.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 14,
  },
  detailAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: t.primaryFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailAvatarText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  detailHeaderText: { flex: 1 },
  detailName: { fontSize: 18, fontWeight: '700', color: t.text },
  detailPhone: { fontSize: 13, color: t.textSecondary, marginTop: 2 },
  closeBtn: { padding: 4 },
  detailStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  detailStat: {
    flex: 1,
    backgroundColor: t.background,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  detailStatLabel: { fontSize: 10, color: t.textSecondary, marginBottom: 4 },
  detailStatValue: { fontSize: 14, fontWeight: '800', color: t.text },
  progressSection: { marginBottom: 16 },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: { fontSize: 13, fontWeight: '600', color: t.text },
  progressCount: { fontSize: 13, fontWeight: '700', color: t.primary },
  progressBar: {
    height: 8,
    backgroundColor: t.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: t.primaryFill,
    borderRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    marginBottom: 4,
  },
  infoText: { flex: 1, fontSize: 14, color: t.text },
  whatsappBtn: {
    backgroundColor: '#25D366',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginBottom: 10,
    marginTop: 10,
  },
  whatsappBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  paidBtn: {
    backgroundColor: t.successFill,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginBottom: 10,
  },
  paidBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 8,
  },
  deleteBtnText: { color: t.danger, fontSize: 14, fontWeight: '600' },
});
