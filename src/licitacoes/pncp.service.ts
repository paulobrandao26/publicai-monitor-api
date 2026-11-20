import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

const PAGINAS = 8;
const TAMANHO_PAGINA = 50;
const MAX_RESULTADOS = 10;
const CACHE_MS = 15 * 60 * 1000; // 15 min

interface Cache {
  dados: any[];
  validoAte: number;
}

@Injectable()
export class PncpService {
  private readonly logger = new Logger(PncpService.name);
  private readonly baseUrl = 'https://pncp.gov.br/api/consulta/v1';
  // O PNCP limita chamadas (erro 429). Guardamos a lista e filtramos por palavra aqui.
  private readonly cache = new Map<string, Cache>();
  private readonly carregando = new Map<string, Promise<any[]>>();

  async buscarLicitacoes(palavra: string) {
    const termo = this.radical(this.normalizar(palavra));
    if (!termo) return [];

    // 1º: só licitações que ainda recebem propostas (as que interessam).
    const abertas = await this.listar('/contratacoes/proposta', {
      dataFinal: this.formatarData(this.somarDias(new Date(), 120)),
    });
    let filtradas = this.filtrar(abertas, termo);

    // 2º: se nada aberto bater, mostra as publicadas nos últimos 30 dias (como antes).
    if (filtradas.length === 0) {
      const recentes = await this.listar('/contratacoes/publicacao', {
        dataInicial: this.formatarData(this.somarDias(new Date(), -30)),
        dataFinal: this.formatarData(new Date()),
      });
      filtradas = this.filtrar(recentes, termo);
    }

    return filtradas.slice(0, MAX_RESULTADOS);
  }

  private async listar(caminho: string, params: Record<string, string>) {
    const salvo = this.cache.get(caminho);
    if (salvo && salvo.validoAte > Date.now()) return salvo.dados;

    // Se já tem uma carga em andamento, espera a mesma (não repete chamadas).
    let promessa = this.carregando.get(caminho);
    if (!promessa) {
      promessa = this.buscarPaginas(caminho, params).finally(() =>
        this.carregando.delete(caminho),
      );
      this.carregando.set(caminho, promessa);
    }
    const dados = await promessa;
    if (dados.length > 0) {
      this.cache.set(caminho, { dados, validoAte: Date.now() + CACHE_MS });
    }
    return dados.length > 0 ? dados : (salvo?.dados ?? []);
  }

  // Uma página por vez, com uma nova tentativa se o PNCP pedir calma (429).
  private async buscarPaginas(caminho: string, params: Record<string, string>) {
    const todas: any[] = [];
    for (let pagina = 1; pagina <= PAGINAS; pagina++) {
      const dados = await this.buscarPagina(caminho, params, pagina);
      if (dados === null) break;
      todas.push(...dados);
      if (dados.length < TAMANHO_PAGINA) break;
    }
    return todas;
  }

  private async buscarPagina(
    caminho: string,
    params: Record<string, string>,
    pagina: number,
    tentativa = 1,
  ): Promise<any[] | null> {
    try {
      const r = await axios.get(`${this.baseUrl}${caminho}`, {
        params: {
          ...params,
          pagina,
          tamanhoPagina: TAMANHO_PAGINA,
          codigoModalidadeContratacao: 6, // pregão eletrônico
        },
        timeout: 25_000,
      });
      return Array.isArray(r.data?.data) ? r.data.data : [];
    } catch (e: any) {
      if (e?.response?.status === 429 && tentativa < 3) {
        await new Promise((ok) => setTimeout(ok, 1500 * tentativa));
        return this.buscarPagina(caminho, params, pagina, tentativa + 1);
      }
      this.logger.warn(
        `PNCP ${caminho} página ${pagina} falhou: ${e?.message}`,
      );
      return null;
    }
  }

  private filtrar(lista: any[], termo: string) {
    const vistos = new Set<string>();
    return lista.filter((lic) => {
      if (!lic?.numeroControlePNCP || vistos.has(lic.numeroControlePNCP))
        return false;
      vistos.add(lic.numeroControlePNCP);
      return this.normalizar(lic.objetoCompra ?? '').includes(termo);
    });
  }

  // Minúsculas e sem acento: "Técnico" encontra "tecnico".
  private normalizar(texto: string) {
    return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  // Tira o plural simples: "computadores" também encontra "computador".
  private radical(termo: string) {
    if (termo.includes(' ') || termo.length < 5) return termo;
    if (termo.endsWith('res') || termo.endsWith('ses'))
      return termo.slice(0, -2);
    if (termo.endsWith('s')) return termo.slice(0, -1);
    return termo;
  }

  private somarDias(data: Date, dias: number) {
    const nova = new Date(data);
    nova.setDate(nova.getDate() + dias);
    return nova;
  }

  private formatarData(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}${mes}${dia}`;
  }
}
