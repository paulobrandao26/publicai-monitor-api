import { Module } from '@nestjs/common';
import { LicitacoesController } from './licitacoes.controller';
import { LicitacoesService } from './licitacoes.service';
import { PncpService } from './pncp.service';

@Module({
  controllers: [LicitacoesController],
  providers: [LicitacoesService, PncpService],
})
export class LicitacoesModule {}
