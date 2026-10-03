import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AlertCriticality } from './entities/alert.entity';
import type { AiGenerateAlertDto } from './dto/communications.dto';

export interface AiAlertDraft {
  title: string;
  message: string;
  criticality: AlertCriticality;
  zone: string | null;
  recommendations: string[];
  vulnerableRecommendations: string[];
  aiGenerated: boolean;
}

interface RuleTemplate {
  criticality: AlertCriticality;
  title: (zone: string | null) => string;
  message: (zone: string | null) => string;
  recommendations: string[];
  vulnerableRecommendations: string[];
}

const RULES: Array<{ keywords: string[]; template: RuleTemplate }> = [
  {
    keywords: [
      'chaleur',
      'canicule',
      'sécheresse',
      'sècheresse',
      'tres haute temperature',
      'forte chaleur',
    ],
    template: {
      criticality: 'critical',
      title: () => 'Vague de chaleur extrême',
      message: (zone) =>
        `Une vague de chaleur extrême touche${zonePhrase(zone, '') || ' plusieurs secteurs de la ville'}. Restez informés et suivez les consignes ci-dessous pour vous protéger.`,
      recommendations: [
        'Restez à l’ombre et évitez les efforts physiques entre 12h et 16h',
        'Buvez de l’eau régulièrement, même sans sensation de soif',
        'Rafraîchissez-vous et passez du temps dans les lieux climatisés ou ombragés',
        'Surveillez les personnes les plus fragiles de votre entourage',
      ],
      vulnerableRecommendations: [
        'Les personnes âgées et les enfants doivent être accompagnés et surveillés de près',
        'Vérifiez quotidiennement l’état de vos proches vulnérables',
        'En cas de malaise, contactez immédiatement les secours',
      ],
    },
  },
  {
    keywords: [
      'inondation',
      'crue',
      'montée des eaux',
      'niveau de l’eau',
      'niveau de l eau',
      'pluie',
      'eau',
    ],
    template: {
      criticality: 'critical',
      title: () => 'Risque d’inondation',
      message: (zone) =>
        `Une montée inhabituelle du niveau de l’eau est observée${zonePhrase(zone) || ' dans plusieurs secteurs'}. La situation est suivie en continu par le centre de surveillance.`,
      recommendations: [
        'Évitez de vous déplacer à pied ou en voiture dans les zones inondées',
        'Surélevez vos objets de valeur et vos équipements sensibles',
        'Coupez le gaz et l’électricité en cas d’infiltration dans votre logement',
        'Suivez les consignes des secours et des autorités',
      ],
      vulnerableRecommendations: [
        'Les personnes à mobilité réduite doivent être aidées pour rejoindre un étage sûr',
        'Préparez un kit d’urgence (médicaments, papiers, eau)',
        'Prévoyez un point de contact avec un proche pour signaler votre situation',
      ],
    },
  },
  {
    keywords: [
      'froid',
      'neige',
      'verglas',
      'gel',
      'tempête',
      'vent',
      'ouragan',
    ],
    template: {
      criticality: 'warning',
      title: () => 'Conditions météorologiques dangereuses',
      message: (zone) =>
        `Des conditions météorologiques dangereuses sont attendues${zonePhrase(zone) || ' sur la commune'}. Limitez vos déplacements et préparez-vous.`,
      recommendations: [
        'Limitez vos déplacements et privilégiez les transports en commun',
        'Équipez vos véhicules (pneus, chaînes) et prévoyez des vêtements chauds',
        'Sécurisez les objets susceptibles d’être emportés par le vent',
      ],
      vulnerableRecommendations: [
        'Les personnes âgées doivent éviter toute sortie non essentielle',
        'Vérifiez le bon fonctionnement de votre chauffage',
        'Signalez toute personne vulnérable isolée au service d’aide à domicile',
      ],
    },
  },
  {
    keywords: ['incendie', 'feu', 'fumée', 'explosion'],
    template: {
      criticality: 'critical',
      title: () => 'Alerte incendie',
      message: (zone) =>
        `Un incendie est en cours${zonePhrase(zone) || ' à proximité'}. Les secours sont mobilisés. Éloignez-vous de la zone et suivez les consignes.`,
      recommendations: [
        'Évacuez immédiatement la zone concernée',
        'Fermez portes et fenêtres si vous restez à l’intérieur',
        'Ne bloquez pas les accès pour les véhicules de secours',
      ],
      vulnerableRecommendations: [
        'Aidez les personnes à mobilité réduite à évacuer',
        'Prévenez les secours si une personne est restée dans un bâtiment',
      ],
    },
  },
];

const DEFAULT_TEMPLATE: RuleTemplate = {
  criticality: 'warning',
  title: () => 'Situation nécessitant votre attention',
  message: (zone) =>
    `Une situation inhabituelle est signalée${zonePhrase(zone) || ' dans la ville'}. Restez attentifs aux consignes des autorités locales.`,
  recommendations: [
    'Suivez les consignes des autorités locales',
    'Restez informés via la plateforme municipale',
  ],
  vulnerableRecommendations: [
    'Les publics vulnérables doivent être informés par leurs proches',
    'En cas d’urgence, contactez les secours',
  ],
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** "Quartier Sud" -> "le quartier Sud" ; "Sud" -> "le quartier Sud". */
function zonePhrase(zone: string | null, preposition = 'dans'): string {
  if (!zone) return '';
  const trimmed = zone.trim();
  const short = trimmed
    .toLowerCase()
    .replace(/^quartier\s+/, '')
    .replace(/^zone\s+/, '');
  const prefix = preposition ? ` ${preposition} ` : ' ';
  return `${prefix}${short ? `le quartier ${short}` : trimmed}`;
}

@Injectable()
export class AiAlertService {
  private readonly logger = new Logger(AiAlertService.name);

  constructor(private readonly config: ConfigService) {}

  private get aiConfig(): { url: string; key: string; model: string } | null {
    const url = this.config.get<string>('AI_API_URL')?.trim();
    const key = this.config.get<string>('AI_API_KEY')?.trim();
    if (!url || !key) return null;
    return {
      url,
      key,
      model: this.config.get<string>('AI_MODEL') ?? 'gpt-4o-mini',
    };
  }

  async generate(input: AiGenerateAlertDto): Promise<AiAlertDraft> {
    const config = this.aiConfig;
    if (config) {
      try {
        return await this.callLlm(config, input);
      } catch (error) {
        this.logger.warn(
          `AI generation failed (${error instanceof Error ? error.message : 'unknown'}) — falling back to rule engine`,
        );
      }
    }
    return this.ruleBased(input);
  }

  private ruleBased(input: AiGenerateAlertDto): AiAlertDraft {
    const normalized = normalize(input.situation);
    const matched =
      RULES.find((rule) =>
        rule.keywords.some((k) => normalized.includes(normalize(k))),
      )?.template ?? DEFAULT_TEMPLATE;
    const zone = input.zone?.trim() || null;
    return {
      title: matched.title(zone),
      message: matched.message(zone),
      criticality: matched.criticality,
      zone,
      recommendations: matched.recommendations,
      vulnerableRecommendations: matched.vulnerableRecommendations,
      aiGenerated: false,
    };
  }

  private async callLlm(
    config: { url: string; key: string; model: string },
    input: AiGenerateAlertDto,
  ): Promise<AiAlertDraft> {
    const system = [
      'Tu es le service d’alerte intelligent de la ville de Nova Terra.',
      'À partir d’une situation décrite par un agent, produis UNIQUEMENT un objet JSON valide avec les champs :',
      '"title" (titre court), "message" (consignes claires : quoi faire, 2-5 phrases),',
      '"criticality" (info | warning | critical), "recommendations" (liste de 3-6 conseils généraux),',
      '"vulnerableRecommendations" (liste de 2-4 recommandations adaptées aux personnes vulnérables : âgées, isolées, à mobilité réduite).',
      'Réponds en français, sauf si la langue demandée est précisée.',
    ].join(' ');
    const user =
      `Situation : ${input.situation}` +
      (input.zone ? `\nZone/quartier concerné : ${input.zone}` : '') +
      (input.language ? `\nLangue de réponse : ${input.language}` : '');

    const res = await fetch(
      `${config.url.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.key}`,
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!res.ok) {
      throw new Error(`AI API responded ${res.status}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI API returned no content');
    const parsed = JSON.parse(content) as Partial<AiAlertDraft>;
    if (!parsed.title || !parsed.message) {
      throw new Error('AI API returned an invalid draft');
    }
    return {
      title: String(parsed.title).slice(0, 200),
      message: String(parsed.message).slice(0, 10_000),
      criticality: ['info', 'warning', 'critical'].includes(
        String(parsed.criticality),
      )
        ? (parsed.criticality as AlertCriticality)
        : 'warning',
      zone: input.zone?.trim() || null,
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map((r) => String(r)).slice(0, 8)
        : [],
      vulnerableRecommendations: Array.isArray(parsed.vulnerableRecommendations)
        ? parsed.vulnerableRecommendations.map((r) => String(r)).slice(0, 6)
        : [],
      aiGenerated: true,
    };
  }
}
