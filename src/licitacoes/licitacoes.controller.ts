import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { LicitacoesService } from './licitacoes.service';

class ResumirDto {
  descricao: string;
}

@Controller('licitacoes')
export class LicitacoesController {
  constructor(private readonly licitacoesService: LicitacoesService) {}

  @Post('resumir')
  async resumir(@Body() body: ResumirDto) {
    const resumo = await this.licitacoesService.resumirLicitacao(
      body.descricao,
    );
    return { resumo };
  }

  @Get('buscar')
  async buscar(@Query('palavra') palavra: string) {
    const resultado = await this.licitacoesService.buscarEAnalisar(palavra);
    return resultado;
  }
}
