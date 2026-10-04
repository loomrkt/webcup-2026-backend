import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { ApiSuccessResponse } from '../../common/api-response';
import { paginated, success } from '../../common/api-response';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { CivicService } from './civic.service';
import {
  CreateConsultationDto,
  CreateIdeaDto,
  CreateProjectDto,
  ListQueryDto,
  RespondConsultationDto,
  SubmitFeedbackDto,
  UpdateConsultationDto,
  UpdateIdeaDto,
  UpdateProjectDto,
} from './dto/civic.dto';
import { CitizenIdea } from './entities/citizen-idea.entity';
import { CityProject } from './entities/city-project.entity';
import { Consultation } from './entities/consultation.entity';
import { ConsultationResponse } from './entities/consultation-response.entity';
import { ProjectFeedback } from './entities/project-feedback.entity';

function toBool(value?: string): boolean {
  return value === '1' || value === 'true';
}

@Controller('projects')
@UseGuards(PermissionsGuard)
export class ProjectsController {
  constructor(private readonly civic: CivicService) {}

  @Get()
  @Public()
  async list(
    @Query('light') light?: string,
  ): Promise<ApiSuccessResponse<Partial<CityProject>[]>> {
    return success(
      await this.civic.listProjects(toBool(light)),
      'Projects fetched',
    );
  }

  @Get(':id')
  @Public()
  async get(@Param('id') id: string): Promise<ApiSuccessResponse<CityProject>> {
    return success(await this.civic.getProject(id), 'Project fetched');
  }

  @Get(':id/feedback')
  @RequirePermission('feedback.read')
  async feedback(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<ProjectFeedback[]>> {
    return success(
      await this.civic.listFeedback(currentUser.id, id),
      'Project feedback fetched',
    );
  }

  @Get(':id/feedback/summary')
  @Public()
  async feedbackSummary(
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<unknown>> {
    return success(
      await this.civic.feedbackSummary(id),
      'Project feedback summary fetched',
    );
  }

  @Post(':id/feedback')
  @RequirePermission('feedback.create')
  async submitFeedback(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
    @Body() body: SubmitFeedbackDto,
  ): Promise<ApiSuccessResponse<ProjectFeedback>> {
    return success(
      await this.civic.submitFeedback(currentUser.id, id, body),
      'Feedback saved. Thank you for your contribution.',
      HttpStatus.CREATED,
    );
  }

  @Post()
  @RequirePermission('projects.manage')
  async create(
    @Body() body: CreateProjectDto,
  ): Promise<ApiSuccessResponse<CityProject>> {
    return success(
      await this.civic.createProject(body),
      'Project created',
      HttpStatus.CREATED,
    );
  }

  @Patch(':id')
  @RequirePermission('projects.manage')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateProjectDto,
  ): Promise<ApiSuccessResponse<CityProject>> {
    return success(await this.civic.updateProject(id, body), 'Project updated');
  }

  @Delete(':id')
  @RequirePermission('projects.manage')
  async delete(@Param('id') id: string): Promise<ApiSuccessResponse<null>> {
    await this.civic.deleteProject(id);
    return success(null, 'Project deleted');
  }
}

@Controller('consultations')
@UseGuards(PermissionsGuard)
export class ConsultationsController {
  constructor(private readonly civic: CivicService) {}

  @Get()
  @Public()
  async list(
    @Query('light') light?: string,
  ): Promise<ApiSuccessResponse<Partial<Consultation>[]>> {
    return success(
      await this.civic.listConsultations(toBool(light)),
      'Open consultations fetched',
    );
  }

  @Get('admin')
  @RequirePermission('consultations.manage')
  async listAll(): Promise<ApiSuccessResponse<Consultation[]>> {
    return success(
      await this.civic.listAllConsultations(),
      'Consultations fetched',
    );
  }

  @Get(':id')
  @Public()
  async get(
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<Consultation>> {
    return success(
      await this.civic.getConsultation(id),
      'Consultation fetched',
    );
  }

  @Get(':id/results')
  @Public()
  async results(
    @CurrentUser() currentUser: { id?: string },
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<unknown>> {
    return success(
      await this.civic.results(currentUser?.id ?? null, id),
      'Consultation results fetched',
    );
  }

  @Post(':id/respond')
  @RequirePermission('consultations.respond')
  async respond(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
    @Body() body: RespondConsultationDto,
  ): Promise<
    ApiSuccessResponse<{ response: ConsultationResponse; updated: boolean }>
  > {
    const result = await this.civic.respond(currentUser.id, id, body);
    return success(
      result,
      result.updated
        ? 'Response updated. Thank you for your contribution.'
        : 'Response recorded. Thank you for your contribution.',
      HttpStatus.CREATED,
    );
  }

  @Post()
  @RequirePermission('consultations.manage')
  async create(
    @CurrentUser() currentUser: { id: string },
    @Body() body: CreateConsultationDto,
  ): Promise<ApiSuccessResponse<Consultation>> {
    return success(
      await this.civic.createConsultation(currentUser.id, body),
      'Consultation created',
      HttpStatus.CREATED,
    );
  }

  @Patch(':id')
  @RequirePermission('consultations.manage')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateConsultationDto,
  ): Promise<ApiSuccessResponse<Consultation>> {
    return success(
      await this.civic.updateConsultation(id, body),
      'Consultation updated',
    );
  }

  @Delete(':id')
  @RequirePermission('consultations.manage')
  async delete(@Param('id') id: string): Promise<ApiSuccessResponse<null>> {
    await this.civic.deleteConsultation(id);
    return success(null, 'Consultation deleted');
  }
}

@Controller('ideas')
@UseGuards(PermissionsGuard)
export class IdeasController {
  constructor(private readonly civic: CivicService) {}

  @Post()
  @RequirePermission('ideas.create')
  async create(
    @CurrentUser() currentUser: { id: string },
    @Body() body: CreateIdeaDto,
  ): Promise<ApiSuccessResponse<CitizenIdea>> {
    return success(
      await this.civic.createIdea(currentUser.id, body),
      'Idea recorded. You can follow its status from your citizen space.',
      HttpStatus.CREATED,
    );
  }

  @Get('me')
  @RequirePermission('ideas.read')
  async myIdeas(
    @CurrentUser() currentUser: { id: string },
    @Query() query: ListQueryDto,
  ): Promise<ApiSuccessResponse<CitizenIdea[]>> {
    const result = await this.civic.myIdeas(currentUser.id, query);
    return paginated(
      result.items,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
      'My ideas fetched',
    );
  }

  @Get()
  @Public()
  async list(
    @Query() query: ListQueryDto,
  ): Promise<ApiSuccessResponse<CitizenIdea[]>> {
    const result = await this.civic.listIdeas(query);
    return paginated(
      result.items,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
      'Ideas fetched',
    );
  }

  @Get(':id')
  @Public()
  async get(@Param('id') id: string): Promise<ApiSuccessResponse<CitizenIdea>> {
    return success(await this.civic.getIdea(id), 'Idea fetched');
  }

  @Patch(':id')
  @RequirePermission('ideas.manage')
  async update(
    @CurrentUser() currentUser: { id: string },
    @Param('id') id: string,
    @Body() body: UpdateIdeaDto,
  ): Promise<ApiSuccessResponse<CitizenIdea>> {
    return success(
      await this.civic.updateIdea(currentUser.id, id, body),
      'Idea updated',
    );
  }

  @Delete(':id')
  @RequirePermission('ideas.manage')
  async delete(@Param('id') id: string): Promise<ApiSuccessResponse<null>> {
    await this.civic.deleteIdea(id);
    return success(null, 'Idea deleted');
  }
}
