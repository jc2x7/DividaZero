/**
 * Configuração de serviços externos.
 *
 * O token abaixo é um portão simples: evita que qualquer um consuma a API por
 * acidente. Como todo segredo embutido em app de celular, ele é extraível por
 * quem se dispuser a abrir o pacote — a proteção real é o rate limit e o fato
 * de o servidor não guardar nada.
 */
export const EXTRATO_API_URL = 'https://julio.api.br/api/extrato';
export const EXTRATO_API_TOKEN = 'ce91352d7d952711a080a45159509e84e7c4057f1dfd2630';
