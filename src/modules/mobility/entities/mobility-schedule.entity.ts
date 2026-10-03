import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MobilityLine } from './mobility-line.entity';

export const SCHEDULE_DAY_TYPES = ['weekday', 'saturday', 'sunday'] as const;
export type ScheduleDayType = (typeof SCHEDULE_DAY_TYPES)[number];

@Entity('mob_schedules')
export class MobilitySchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => MobilityLine, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'line_id' })
  line: MobilityLine;

  @Column({ name: 'line_id', type: 'uuid' })
  lineId: string;

  @Index()
  @Column({ name: 'day_type', type: 'varchar', length: 10, default: 'weekday' })
  dayType: ScheduleDayType;

  @Column({ type: 'varchar', length: 120, nullable: true })
  destination: string | null;

  @Index()
  @Column({ name: 'departure_time', type: 'varchar', length: 5 })
  departureTime: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
