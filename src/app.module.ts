import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LicitacoesModule } from './licitacoes/licitacoes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LicitacoesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
