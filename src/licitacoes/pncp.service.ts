import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class PncpService {
  private readonly baseUrl = 'https://pncp.gov.br/api/consulta/v1';

  async buscarLicitacoes(palavra: string) {
    const hoje = new Date();
    const dataFinal = this.formatarData(hoje);

    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    const dataInicial = this.formatarData(trintaDiasAtras);

    const response = await axios.get(
      `${this.baseUrl}/contratacoes/publicacao`,
      {
        params: {
          dataInicial,
          dataFinal,
          pagina: 1,
          tamanhoPagina: 10,
          codigoModalidadeContratacao: 6,
          q: palavra,
        },
      },
    );

    return response.data.data;
  }

  private formatarData(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}${mes}${dia}`;
  }
}
