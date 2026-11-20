import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';
import { PncpService } from './pncp.service';

// O modelo antigo (llama-3.3-70b-versatile) foi desligado pela Groq em 16/08/2026.
// Por isso o modelo agora vem da variável GROQ_MODEL, com um padrão que existe hoje.
const MODELO_PADRAO = 'openai/gpt-oss-20b';

interface Analise {
  nota: number;
  justificativa: string;
  palavrasChave: string[];
}

@Injectable()
export class LicitacoesService {
  private readonly logger = new Logger(LicitacoesService.name);
  private readonly modelo = process.env.GROQ_MODEL || MODELO_PADRAO;
  private clientCache?: Groq;

  constructor(private readonly pncpService: PncpService) {
    if (!process.env.GROQ_API_KEY) {
      this.logger.warn(
        'GROQ_API_KEY não definida: a busca funciona, mas sem análise da IA.',
      );
    }
  }

  // Cria o cliente só quando precisa, para o servidor subir mesmo sem a chave.
  private get client(): Groq {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY não definida');
    this.clientCache ??= new Groq({ apiKey: process.env.GROQ_API_KEY });
    return this.clientCache;
  }

  async resumirLicitacao(descricao: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.modelo,
      messages: [
        {
          role: 'user',
          content: `Resuma essa licitação pública de forma clara e objetiva, em português: ${descricao}`,
        },
      ],
    });

    return (
      response.choices[0].message.content ?? 'Não foi possível gerar o resumo.'
    );
  }

  async buscarEAnalisar(palavra: string) {
    const licitacoes = await this.pncpService.buscarLicitacoes(palavra ?? '');

    if (!licitacoes || licitacoes.length === 0) {
      return [];
    }

    // Analisa de 3 em 3 para não estourar o limite do plano grátis da Groq.
    const analisadas: Awaited<ReturnType<LicitacoesService['analisar']>>[] = [];
    for (let i = 0; i < licitacoes.length; i += 3) {
      const lote = licitacoes.slice(i, i + 3);
      analisadas.push(
        ...(await Promise.all(lote.map((lic: any) => this.analisar(lic)))),
      );
    }

    return analisadas.sort((a, b) => b.nota - a.nota);
  }

  private async analisar(lic: any) {
    const base = {
      id: lic.numeroControlePNCP,
      objeto: lic.objetoCompra,
      orgao: lic.orgaoEntidade?.razaoSocial ?? 'Desconhecido',
      valor: lic.valorTotalEstimado,
      prazo: lic.dataEncerramentoProposta,
    };

    try {
      const resposta = await this.client.chat.completions.create({
        model: this.modelo,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: `Analise essa licitação e dê uma nota de 0 a 10 sobre o potencial de oportunidade para uma empresa de tecnologia. Responda APENAS em JSON válido, em português, no formato exato: {"nota": number, "justificativa": "string", "palavrasChave": ["string"]}. Licitação: ${lic.objetoCompra}`,
          },
        ],
      });

      return { ...base, ...this.lerJson(resposta.choices[0].message.content) };
    } catch (e: any) {
      this.logger.error(
        `Erro ao analisar ${lic.numeroControlePNCP}: ${e?.status ?? ''} ${e?.message ?? e}`,
      );
      return {
        ...base,
        nota: 0,
        justificativa: 'Erro ao analisar esta licitação.',
        palavrasChave: [] as string[],
      };
    }
  }

  private lerJson(texto: string | null | undefined): Analise {
    try {
      const limpo = (texto ?? '{}')
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      const dados = JSON.parse(limpo);
      const nota = Number(dados.nota);
      return {
        nota: Number.isFinite(nota) ? Math.max(0, Math.min(10, nota)) : 0,
        justificativa:
          typeof dados.justificativa === 'string'
            ? dados.justificativa
            : 'Sem análise disponível.',
        palavrasChave: Array.isArray(dados.palavrasChave)
          ? dados.palavrasChave.filter((p: unknown) => typeof p === 'string')
          : [],
      };
    } catch (e) {
      this.logger.warn(`Resposta da IA não era JSON válido: ${e}`);
      return {
        nota: 0,
        justificativa: 'Não foi possível analisar.',
        palavrasChave: [],
      };
    }
  }
}
