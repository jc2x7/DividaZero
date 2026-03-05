import { Linking, Alert } from 'react-native';
import { formatCurrency } from './formatting';

/**
 * Build a WhatsApp web link URL (wa.me) — funciona sem precisar do app instalado
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  // Ensure Brazilian country code
  const fullPhone = digits.startsWith('55') ? digits : `55${digits}`;
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${fullPhone}?text=${encoded}`;
}

/**
 * Build a collection message for a loan
 */
export function buildCollectionMessage(
  name: string,
  amount: number,
  dueDate: string,
  installmentCurrent: number,
  installmentsTotal: number
): string {
  const formattedAmount = formatCurrency(amount);
  return (
    `Olá ${name}! 😊\n\n` +
    `Passando para lembrar do pagamento de *${formattedAmount}* ` +
    `(parcela ${installmentCurrent}/${installmentsTotal}) ` +
    `que vence amanhã, dia *${dueDate}*.\n\n` +
    `Por favor, confirme o pagamento. Obrigado! 🙏`
  );
}

/**
 * Open WhatsApp with a pre-filled message
 */
export async function openWhatsAppCollection(
  name: string,
  phone: string,
  amount: number,
  dueDate: string,
  installmentCurrent: number,
  installmentsTotal: number
): Promise<void> {
  const message = buildCollectionMessage(
    name,
    amount,
    dueDate,
    installmentCurrent,
    installmentsTotal
  );
  const url = buildWhatsAppUrl(phone, message);

  try {
    // Abre diretamente o link wa.me no navegador (funciona com ou sem WhatsApp instalado)
    await Linking.openURL(url);
  } catch {
    Alert.alert('Erro', 'Não foi possível abrir o link do WhatsApp.');
  }
}
