import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateConversationDto {
  @IsOptional()
  @IsUUID()
  memberId?: string;

  // @purge:groups-start
  @IsOptional()
  @IsString()
  @Matches(/^(direct|group)$/, {
    message: 'type must be direct or group',
  })
  type?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  memberIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WrappedMemberKeyDto)
  memberKeys?: WrappedMemberKeyDto[];
  // @purge:groups-end
}

// @purge:groups-start
export class WrappedMemberKeyDto {
  @IsUUID()
  userId: string;

  @IsString()
  @MinLength(20)
  @MaxLength(500)
  key: string;
}

export class AddMemberDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(500)
  wrappedKey?: string;
}

export class RemoveMemberDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WrappedMemberKeyDto)
  newWrappedKeys?: WrappedMemberKeyDto[];
}

export class UpdateMemberDto {
  @IsOptional()
  @Matches(/^(admin|member)$/, {
    message: 'role must be admin or member',
  })
  role?: string;

  @IsOptional()
  @IsBoolean()
  muted?: boolean;
}
// @purge:groups-end

// @purge:e2ee-start
export class WrappedKeyDto {
  @IsUUID()
  userId: string;

  @IsString()
  @MinLength(20)
  @MaxLength(500)
  key: string;
}

export class PublishKeyDto {
  @IsString()
  @MinLength(20)
  @MaxLength(1024)
  publicKey: string;

  @IsString()
  @MinLength(20)
  @MaxLength(1024)
  signature: string;
}
// @purge:e2ee-end

export class CreateMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  content: string;

  // @purge:replies-start
  @IsOptional()
  @IsUUID()
  replyToId?: string;
  // @purge:replies-end

  // @purge:e2ee-start
  @IsOptional()
  @IsBoolean()
  e2ee?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  iv?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WrappedKeyDto)
  wrappedKeys?: WrappedKeyDto[];
  // @purge:e2ee-end
}

// @purge:edit-delete-start
export class EditMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  content: string;
}
// @purge:edit-delete-end

export class ListMessagesQueryDto {
  @IsOptional()
  @IsString()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

// @purge:block-start
export class BlockUserDto {
  @IsUUID()
  userId: string;
}
// @purge:block-end

// @purge:presence-start
export class UpdatePresenceDto {
  @IsString()
  @Matches(/^(online|away|offline)$/, {
    message: 'status must be online|away|offline',
  })
  status: string;
}
// @purge:presence-end
