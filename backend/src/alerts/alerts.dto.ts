import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ALERT_CONDITIONS, type AlertCondition } from './alert.entity.js';

export class CreateAlertDto {
  @IsString()
  @Matches(/^[A-Za-z0-9.\-^]{1,20}$/)
  symbol: string;

  @IsIn(ALERT_CONDITIONS)
  condition: AlertCondition;

  @IsNumber()
  threshold: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  cooldownMinutes?: number;

  @IsOptional()
  @IsBoolean()
  oneShot?: boolean;
}

export class UpdateAlertDto {
  @IsOptional()
  @IsIn(ALERT_CONDITIONS)
  condition?: AlertCondition;

  @IsOptional()
  @IsNumber()
  threshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  cooldownMinutes?: number;

  @IsOptional()
  @IsBoolean()
  oneShot?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
