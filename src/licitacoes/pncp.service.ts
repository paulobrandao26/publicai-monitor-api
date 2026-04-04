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

    const paginas = [1, 2, 3, 4, 5];

    const requests = paginas.map((pagina) =>
      axios.get(`${this.baseUrl}/contratacoes/publicacao`, {
        params: {
          dataInicial,
          dataFinal,
          pagina,
          tamanhoPagina: 50,
          codigoModalidadeContratacao: 6,
        },
      }),
    );

    const respostas = await Promise.all(requests);
    const todas = respostas.flatMap((r) => r.data.data);

    const filtradas = todas.filter((lic: any) =>
      lic.objetoCompra?.toLowerCase().includes(palavra.toLowerCase()),
    );

    return filtradas.slice(0, 10);
  }

  private formatarData(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}${mes}${dia}`;
  }
}
