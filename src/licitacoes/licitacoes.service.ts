import { Injectable } from '@nestjs/common';
import Groq from 'groq-sdk';

@Injectable()
export class LicitacoesService {
  private client: Groq;

  constructor() {
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
}
