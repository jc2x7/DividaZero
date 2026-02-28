import { Linking, Alert } from 'react-native';
import { formatCurrency } from './formatting';

/**
 * Build a WhatsApp deep link URL
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  // Ensure Brazilian country code
  const fullPhone = digits.startsWith('55') ? digits : `55${digits}`;
  const encoded = encodeURIComponent(message);
  return `whatsapp://send?phone=${fullPhone}&text=${encoded}`;
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
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      // Fallback to web.whatsapp.com
      const digits = phone.replace(/\D/g, '');
      const fullPhone = digits.startsWith('55') ? digits : `55${digits}`;
      const webUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
      await Linking.openURL(webUrl);
    }
  } catch {
    Alert.alert(
      'Erro',
      'Não foi possível abrir o WhatsApp. Verifique se o aplicativo está instalado.'
    );
  }
}
