/**
 * Cliente da API de leitura de extrato.
 *
 * O que sai do aparelho é o PDF do extrato, e só quando o usuário escolhe
 * importar. O servidor não guarda nada: processa, responde e apaga o arquivo.
 */
import { EXTRATO_API_URL, EXTRATO_API_TOKEN } from '../constants/config';

export interface TransacaoExtrato {
  data: string;
  descricao: string;
  padrao: string;
  valor: number;
  tipo: 'ENTRADA' | 'SAIDA';
  interno: boolean;
  categoria: string;
  parcela: { atual: number; total: number } | null;
}

export interface ResumoExtrato {
  total: number;
  reais: number;
  internas: number;
  parceladas: number;
  entradas: number;
  saidas: number;
  de: string | null;
  ate: string | null;
  padroes_distintos: number;
  categorias: Record<string, number>;
}

export interface RespostaExtrato {
  transacoes: TransacaoExtrato[];
  resumo: ResumoExtrato;
  diagnostico: { modelo: string; cobertura: number; segundos: number };
}

export class ExtratoError extends Error {}

/** Extrato de 6 meses leva ~30 s; damos folga antes de desistir. */
const TIMEOUT_MS = 300_000;

export async function analisarExtrato(
  uri: string,
  nomeArquivo: string
): Promise<RespostaExtrato> {
  const form = new FormData();
  form.append('arquivo', {
    uri,
    name: nomeArquivo || 'extrato.pdf',
    type: 'application/pdf',
  } as never);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(`${EXTRATO_API_URL}/v1/extrato`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${EXTRATO_API_TOKEN}` },
      body: form,
      signal: controller.signal,
    });

    if (!resp.ok) {
      // A API devolve {detail: "..."} com uma mensagem já escrita para o usuário.
      let detalhe = '';
      try {
        detalhe = (await resp.json())?.detail ?? '';
      } catch {
        /* corpo não-JSON */
      }
      throw new ExtratoError(
        detalhe ||
          (resp.status === 401
            ? 'Não foi possível autenticar com o servidor.'
            : `O servidor respondeu ${resp.status}.`)
      );
    }

    return (await resp.json()) as RespostaExtrato;
  } catch (e) {
    if (e instanceof ExtratoError) throw e;
    if ((e as Error)?.name === 'AbortError') {
      throw new ExtratoError('O servidor demorou demais para responder. Tente de novo.');
    }
    throw new ExtratoError('Sem conexão com o servidor. Verifique sua internet.');
  } finally {
    clearTimeout(timer);
  }
}
