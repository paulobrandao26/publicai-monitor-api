import { Injectable } from '@nestjs/common';
import Groq from 'groq-sdk';
import { PncpService } from './pncp.service';

@Injectable()
export class LicitacoesService {
  private client: Groq;

  constructor(private readonly pncpService: PncpService) {
    this.client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  async resumirLicitacao(descricao: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'user',
          content: `Resuma essa licitação pública de forma clara e objetiva: ${descricao}`,
        },
      ],
    });

    return (
      response.choices[0].message.content ?? 'Não foi possível gerar o resumo.'
    );
  }

  async buscarEAnalisar(palavra: string) {
    const licitacoes = await this.pncpService.buscarLicitacoes(palavra);

    const analisadas = await Promise.all(
      licitacoes.map(async (lic: any) => {
        const analise = await this.client.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'user',
              content: `Analise essa licitação e dê uma nota de 0 a 10 sobre o potencial de oportunidade para uma empresa de tecnologia. Responda em JSON com os campos: nota (number), justificativa (string), palavrasChave (array de strings). Licitação: ${lic.objetoCompra}`,
            },
          ],
        });

        let analiseJson = { nota: 0, justificativa: '', palavrasChave: [] };
        try {
          const texto = analise.choices[0].message.content ?? '{}';
          const clean = texto.replace(/```json|```/g, '').trim();
          analiseJson = JSON.parse(clean);
        } catch (e) {}

        return {
          id: lic.numeroControlePNCP,
          objeto: lic.objetoCompra,
          orgao: lic.orgaoEntidade.razaoSocial,
          valor: lic.valorTotalEstimado,
          prazo: lic.dataEncerramentoProposta,
          nota: analiseJson.nota,
          justificativa: analiseJson.justificativa,
          palavrasChave: analiseJson.palavrasChave,
        };
      }),
    );

    return analisadas.sort((a, b) => b.nota - a.nota);
  }
}
