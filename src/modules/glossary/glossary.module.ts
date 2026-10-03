import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlossaryTerm } from './entities/glossary-term.entity';
import { GlossaryController } from './glossary.controller';
import { GlossaryService } from './glossary.service';

@Module({
  imports: [TypeOrmModule.forFeature([GlossaryTerm])],
  controllers: [GlossaryController],
  providers: [GlossaryService],
  exports: [GlossaryService],
})
export class GlossaryModule {}
