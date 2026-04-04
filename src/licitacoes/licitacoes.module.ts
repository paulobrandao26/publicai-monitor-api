import { Module } from '@nestjs/common';
import { LicitacoesController } from './licitacoes.controller';
import { LicitacoesService } from './licitacoes.service';

@Module({
  controllers: [LicitacoesController],
  providers: [LicitacoesService],
})
export class LicitacoesModule {}
