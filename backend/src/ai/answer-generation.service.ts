import { Injectable } from '@nestjs/common';
import { RetrievedKnowledge } from './knowledge/knowledge-retrieval.service';
import { KnowledgeRecord } from './knowledge/knowledge-loader.service';

type Language = 'sw' | 'en';

export interface AiReference {
  source: string;
  reference: string;
  verified: boolean;
  jurisdiction?: string;
  url?: string;
  note?: string;
}

export interface GeneratedAnswer {
  directAnswer: string;
  explanation: string;
  guidance?: string;
  legalReferences: AiReference[];
  sources: Array<{ id: string; name: string; reference?: string; url?: string }>;
  status: 'answered' | 'no_reliable_answer' | 'safety_guidance';
  generatedBy: 'grounded_fallback' | 'configured_llm';
}

@Injectable()
export class AnswerGenerationService {
  async generate(
    question: string,
    language: Language,
    retrieved: RetrievedKnowledge[],
    safetyRules: Array<{ rule: string; action: string }>,
  ): Promise<GeneratedAnswer> {
    const intent = this.detectIntent(question);
    const evidence = this.relevantEvidence(intent, retrieved);
    const legalReferences = this.references(evidence);
    const hasMatchedQa = evidence.some(({ record }) => record.type === 'example_qa' || record.id.startsWith('QA'));
    const sources = intent === 'general' && !hasMatchedQa ? [] : this.sources(evidence, intent);
    const urgent = this.isUrgent(question);

    const llmAnswer = await this.generateWithConfiguredProvider(question, language, evidence, safetyRules);
    if (llmAnswer) {
      return {
        ...llmAnswer,
        legalReferences,
        sources,
        status: urgent ? 'safety_guidance' : evidence.length ? 'answered' : 'no_reliable_answer',
        generatedBy: 'configured_llm',
      };
    }

    const fallback = this.buildGroundedFallback(intent, question, language, evidence, urgent);
    return {
      ...fallback,
      legalReferences,
      sources,
      status: urgent ? 'safety_guidance' : intent !== 'general' && evidence.length ? 'answered' : 'no_reliable_answer',
      generatedBy: 'grounded_fallback',
    };
  }

  private detectIntent(question: string): string {
    const q = question.toLocaleLowerCase();
    if (/ukeketaji|female genital mutilation|\bfgm\b|genital cutting/.test(q)) return 'fgm';
    if (/ndoa.{0,24}(utotoni|mtoto|umri)|(?:mtoto|msichana|girl|child).{0,24}(kuolewa|kuoa|get married|married)|kuolewa.{0,24}umri|child marriage|married.{0,10}child|marriage.{0,16}(age|child)|what age.{0,20}marry/.test(q)) return 'child_marriage';
    if (/\b(kupiga|kupigwa|anampiga|kumpiga)\b|hit(ting)? a child|corporal punishment/.test(q)) return 'hitting_child';
    if (/elimu|shule|kusoma|school|education|study|kujielimisha/.test(q)) return 'education';
    if (/usawa|equality|discrimination|ubaguzi/.test(q)) return 'equality';
    if (/katiba|constitution|haki za msingi|fundamental rights/.test(q)) return 'constitution_rights';
    if (/hatari|danger|unsafe|threat|salama|protection|kulind|ukatili|unyanyas|abuse|violence/.test(q)) return 'child_safety';
    if (/msaada|support|help|huduma|service|respond|someone told me/.test(q)) return 'support';
    return 'general';
  }

  private relevantEvidence(intent: string, retrieved: RetrievedKnowledge[]): RetrievedKnowledge[] {
    const ids: Record<string, string[]> = {
      fgm: ['LCA160', 'LCA13', 'WHOFGM2025', 'K001', 'K013', 'S001', 'S002'],
      child_marriage: ['LMA13GYUMI', 'CON12', 'CON13', 'LCA09', 'K004', 'K020'],
      hitting_child: ['LCA13', 'K005', 'S001', 'S002'],
      education: ['CON11', 'LCA08'],
      equality: ['CON12', 'CON13'],
      constitution_rights: ['CON11', 'CON12', 'CON13', 'CON14', 'CON16'],
      child_safety: ['LCA09', 'LCA13', 'K005', 'K006', 'K007', 'K013', 'S001', 'S002'],
      support: ['QA001', 'K001', 'K002', 'K006', 'K011', 'K013', 'S001', 'S002'],
    };
    const preferred = ids[intent];
    if (!preferred) return retrieved.filter((item) => item.score >= 0.14).slice(0, 4);
    const byId = new Map(retrieved.map((item) => [item.record.id, item]));
    return preferred.map((id) => byId.get(id)).filter((item): item is RetrievedKnowledge => Boolean(item));
  }

  private buildGroundedFallback(
    intent: string,
    question: string,
    language: Language,
    evidence: RetrievedKnowledge[],
    urgent: boolean,
  ): Pick<GeneratedAnswer, 'directAnswer' | 'explanation' | 'guidance'> {
    const has = (id: string) => evidence.some((item) => item.record.id === id);
    const sw = language === 'sw';
    const asksWhyFgm = intent === 'fgm' && /kwa nini|sababu|madhara|hatari|why|harm|risk/i.test(question);
    if (!evidence.length) {
      if (urgent) {
        return {
          directAnswer: sw
            ? 'Ikiwa uko kwenye hatari ya sasa, jaribu kuelekea sehemu salama na utafute msaada wa mtu halisi.'
            : 'If you are in immediate danger, try to move to a safer place and seek help from a real person.',
          explanation: sw
            ? 'Huhitaji kushiriki maelezo binafsi hapa. SalamaLine AI haiwezi kuwasiliana na huduma za dharura kwa niaba yako.'
            : 'You do not need to share personal details here. SalamaLine AI cannot contact emergency services on your behalf.',
          guidance: sw
            ? 'Ikiwezekana, wasiliana na mtu mzima unayemwamini au huduma husika ya ulinzi katika eneo lako. Usimkabili mtu anayekuweka hatarini.'
            : 'If possible, contact a trusted adult or an appropriate local protection service. Do not confront someone who is putting you at risk.',
        };
      }
      return {
        directAnswer: sw
          ? 'Sina ushahidi wa kutosha kwenye vyanzo vilivyopakiwa kujibu swali hili kwa uhakika.'
          : 'I do not have enough evidence in the loaded sources to answer this reliably.',
        explanation: sw
          ? 'Sitaki kubuni taarifa au rejea za kisheria. Unaweza kuuliza kuhusu haki za watoto, ulinzi, elimu au msaada unaotokana na vyanzo vilivyopakiwa.'
          : 'I will not invent information or legal references. You can ask about child rights, protection, education, or support covered by the loaded sources.',
      };
    }

    switch (intent) {
      case 'fgm':
        return {
          directAnswer: asksWhyFgm
            ? (sw ? 'Hapana. Ukeketaji hauna faida yoyote ya kiafya. Unaweza kusababisha madhara kwa afya na ustawi wa mtoto wa kike.' : 'No. FGM has no health benefit. It can harm a girl’s health and wellbeing.')
            : (sw ? 'Hapana. Ukeketaji wa mtoto wa kike haupaswi kufanywa.' : 'No. Female genital mutilation should not be performed on a girl who is a child.'),
          explanation: sw
            ? [
                has('WHOFGM2025') ? 'Mwongozo wa WHO unaeleza kuwa ukeketaji hauna faida ya kiafya na unaweza kudhuru afya na ustawi.' : '',
                has('LCA160') || has('LCA13') ? 'Mtoto ana haki ya kulindwa dhidi ya vitendo na mila zinazoweza kumdhuru; watu wazima wana wajibu wa kusaidia kulinda afya, usalama na utu wake.' : '',
              ].filter(Boolean).join(' ')
            : [
                has('WHOFGM2025') ? 'WHO guidance explains that FGM has no health benefit and can harm health and wellbeing.' : '',
                has('LCA160') || has('LCA13') ? 'Children have a right to protection from harmful practices, and adults have a responsibility to protect their health, safety and dignity.' : '',
              ].filter(Boolean).join(' '),
          guidance: sw
            ? 'Ikiwa mtoto anaweza kuwa kwenye hatari, anaweza kutafuta msaada kutoka kwa mtu mzima anayemwamini, afisa ustawi wa jamii au mamlaka ya eneo. Usimlazimishe kueleza zaidi au kumkabili mtu anayemweka hatarini.'
            : 'If a child may be at risk, they can seek help from a trusted adult, a social welfare officer, or a local authority. Do not pressure the child to disclose more or confront someone who may put them at risk.',
        };
      case 'child_marriage':
        return {
          directAnswer: sw ? 'Kwa Tanzania Bara, msimamo wa Mahakama ya Rufani ni kwamba umri wa chini wa ndoa ni miaka 18 kwa wote.' : 'For Mainland Tanzania, the Court of Appeal’s position is that the minimum marriage age is 18 for everyone.',
          explanation: sw
            ? 'Hata hivyo, maandishi ya sheria ya ndoa yaliyopo kwenye vyanzo hivi bado yana vifungu vinavyoonyesha umri tofauti, hivyo hali ya kisheria ina utata. Vyanzo hivi vinahusu Tanzania Bara; havitoshi kuthibitisha sheria ya Zanzibar. Kwa uamuzi kuhusu hali maalumu, tafuta ushauri wa kisheria unaotegemea taarifa za sasa.'
            : 'However, the marriage law text in these sources still contains provisions with different ages, so the legal position is complicated. These sources cover Mainland Tanzania and do not establish Zanzibar law. For a specific situation, seek legal advice based on current information.',
          guidance: sw
            ? 'Ikiwa mtoto anakabiliwa na shinikizo au hatari, anaweza kuzungumza na mtu mzima anayemwamini au afisa ustawi wa jamii. Usimlazimishe kuripoti au kukabiliana na mtu anayemshinikiza.'
            : 'If a child is facing pressure or danger, they can speak with a trusted adult or social welfare officer. Do not force them to report or confront the person pressuring them.',
        };
      case 'hitting_child':
        return {
          directAnswer: sw ? 'Hapana—mtoto hastahili kuumizwa au kudhalilishwa kama adhabu.' : 'No—a child should not be hurt or degraded as punishment.',
          explanation: sw
            ? 'Mtoto anastahili kurekebishwa kwa njia inayozingatia umri na hali yake, bila ukatili au udhalilishaji. Kulinda afya na utu wa mtoto ni wajibu wa watu wazima; tukio maalumu linahitaji kuchunguzwa na mtu anayestahili.'
            : 'Discipline should take a child’s age and circumstances into account and must not be cruel or degrading. Adults are responsible for protecting a child’s health and dignity; a specific incident should be assessed by an appropriate professional.',
          guidance: sw
            ? 'Ikiwa mtoto ameumizwa au yuko hatarini, msaada unaweza kutafutwa kutoka kwa mtu mzima anayeaminika au afisa ustawi wa jamii. Mtoto hapaswi kulaumiwa.'
            : 'If a child has been hurt or is at risk, help can be sought from a trusted adult or social welfare officer. The child should not be blamed.',
        };
      case 'education':
        return {
          directAnswer: sw ? 'Ndiyo. Mtoto ana haki ya kupata elimu.' : 'Yes. A child has a right to education.',
          explanation: sw
            ? 'Mtoto wa kike ana haki ya kupata elimu kama watoto wengine. Elimu humsaidia kupata maarifa, kukuza uwezo wake na kujenga maisha yake ya baadaye; hapaswi kunyimwa nafasi ya kusoma kwa sababu tu ni msichana. Wazazi, walezi, jamii na mamlaka husika wana wajibu wa kumsaidia kupata fursa hiyo.'
            : 'A girl has the same right to education as other children. Education helps her build knowledge, develop her abilities and shape her future; she should not be denied the chance to learn because she is a girl. Parents, guardians, communities and relevant authorities all have a role in supporting access.',
        };
      case 'equality':
        return {
          directAnswer: sw ? 'Katiba inasema binadamu wote huzaliwa huru na sawa.' : 'The Constitution says all human beings are born free and equal.',
          explanation: sw
            ? 'Hii ina maana kila mtu anastahili heshima na kutendewa kwa usawa. Ulinzi huo ni muhimu ili watu wasinyimwe haki au fursa kwa sababu ya jinsia, hali au asili yao.'
            : 'That means everyone deserves dignity and equal treatment. These protections matter so people are not denied rights or opportunities because of their gender, circumstances or background.',
        };
      case 'constitution_rights':
        return {
          directAnswer: sw ? 'Katiba inatambua haki za msingi na wajibu katika Sehemu ya Tatu ya Sura ya Kwanza.' : 'The Constitution recognizes basic rights and duties in Part III of Chapter One.',
          explanation: sw
            ? 'Kwa ujumla, zinahakikisha watu wanaheshimiwa, wanalindwa na wanapata nafasi ya kushiriki katika maisha ya jamii. Haki maalumu na namna zinavyotumika hutegemea hali na sheria husika.'
            : 'In everyday terms, they help ensure people are treated with dignity, protected and able to participate in society. Which specific right applies depends on the situation and relevant law.',
        };
      case 'child_safety':
        return {
          directAnswer: sw ? 'Ndiyo. Mtoto ana haki ya kulindwa dhidi ya ukatili na unyanyasaji.' : 'Yes. A child has a right to protection from violence and abuse.',
          explanation: sw
            ? 'Ulinzi huu ni muhimu kwa afya, usalama na ukuaji wa mtoto. Watu wazima wana jukumu la kumsaidia na kumkinga dhidi ya madhara.'
            : 'This protection matters for a child’s health, safety and development. Adults have a responsibility to help keep children safe from harm.',
          guidance: urgent
            ? (sw ? 'Ikiwa hatari ni ya sasa, tafuta sehemu salama ikiwa unaweza na wasiliana na mtu mzima unayemwamini, afisa ustawi wa jamii au mamlaka husika. Si lazima utoe maelezo zaidi hapa; usimkabili mtu anayesababisha hatari.' : 'If the danger is immediate, move to a safer place if possible and contact a trusted adult, social welfare officer, or appropriate local authority. You do not need to share more here; do not confront the person causing the risk.')
            : (sw ? 'Mtoto anaweza kuomba msaada kutoka kwa mtu mzima anayemwamini, afisa ustawi wa jamii au mamlaka ya eneo. Si lazima asimulie kila kitu au achukue hatua peke yake.' : 'A child can seek help from a trusted adult, social welfare officer, or local authority. They do not need to tell every detail or handle the situation alone.'),
        };
      case 'support': {
        const qa = evidence.find((item) => item.record.id.startsWith('QA'))?.record;
        const answer = qa?.[language === 'sw' ? 'answer_sw' : 'answer_en'];
        return {
          directAnswer: typeof answer === 'string'
            ? answer
            : (sw ? 'Ndiyo, msaada wa kibinadamu unaweza kuombwa kwa njia salama unayoichagua.' : 'Yes, you can seek human support through a safe option you choose.'),
          explanation: sw
            ? 'Mtu mzima unayemwamini, afisa ustawi wa jamii au mamlaka husika wanaweza kusaidia. Chagua unachojisikia salama kufanya; si lazima utoe taarifa binafsi hapa.'
            : 'A trusted adult, social welfare officer, or appropriate local authority may be able to help. Choose what feels safe; you do not need to share personal details here.',
          guidance: urgent
            ? (sw ? 'Kama hatari ni ya sasa, songa kuelekea sehemu salama ikiwezekana na utafute msaada wa mtu halisi. SalamaLine AI haiwezi kuwasiliana na huduma za dharura kwa niaba yako.' : 'If danger is immediate, move toward a safer place if possible and contact a real person for support. SalamaLine AI cannot contact emergency services for you.')
            : undefined,
        };
      }
      default: {
        const qa = evidence.find((item) => item.record.id.startsWith('QA'))?.record;
        const qaAnswer = qa?.[language === 'sw' ? 'answer_sw' : 'answer_en'];
        if (typeof qaAnswer === 'string') return { directAnswer: qaAnswer, explanation: '' };
        return {
          directAnswer: sw
            ? 'Sina taarifa za kutosha zilizothibitishwa kujibu swali hili kwa uhakika.'
            : 'I do not have enough verified information to answer this reliably.',
          explanation: sw
            ? 'Sitaki kubuni jibu. Unaweza kuuliza kuhusu ulinzi wa mtoto, elimu, usalama au njia za kupata msaada.'
            : 'I do not want to guess. You can ask about child protection, education, safety, or ways to find support.',
        };
      }
    }
  }

  private references(evidence: RetrievedKnowledge[]): AiReference[] {
    const unique = new Map<string, AiReference>();
    for (const { record } of evidence) {
      const legalTypes = ['constitution', 'legislation', 'legislation_and_case_law'];
      if (!record.citation || typeof record.source_title !== 'string' || !legalTypes.includes(String(record.source_type))) continue;
      const reference: AiReference = {
        source: record.source_title,
        reference: record.citation,
        verified: record.verified === true,
        jurisdiction: typeof record.jurisdiction === 'string' ? record.jurisdiction : undefined,
        url: typeof record.source_url === 'string' ? record.source_url : undefined,
        note: typeof record.verification_note === 'string' ? record.verification_note : undefined,
      };
      unique.set(`${reference.source}|${reference.reference}`, reference);
      if (typeof record.additional_source_url === 'string') {
        unique.set(`${reference.source}|Court of Appeal judgment`, {
          source: record.source_title,
          reference: 'Court of Appeal judgment, Civil Appeal No. 204 of 2017, delivered 23 October 2019',
          verified: true,
          jurisdiction: typeof record.jurisdiction === 'string' ? record.jurisdiction : undefined,
          url: record.additional_source_url,
        });
      }
    }
    return [...unique.values()];
  }

  private sources(evidence: RetrievedKnowledge[], intent: string) {
    const catalog: Record<string, { name: string; url?: string }> = {
      WHO_TRAINING_2021: { name: 'WHO: Caring for women subjected to violence', url: 'https://www.who.int/publications/i/item/9789240039803' },
      TZA_LCA_2023: { name: 'Sheria ya Mtoto ya Tanzania Bara (Law of the Child Act)', url: 'https://oagmis.oag.go.tz/portal/acts/revised/555/download' },
      WHO_CLINICAL_HANDBOOK_2014: { name: 'WHO: Clinical handbook on care for women subjected to violence', url: 'https://www.who.int/publications/i/item/WHO-RHR-14.26' },
      TZA_NPA_VAWC_II_2024_2029: { name: 'National Plan of Action to End Violence Against Women and Children II' },
      TZA_CONSTITUTION_OAG_2009: { name: 'Katiba ya Jamhuri ya Muungano wa Tanzania', url: 'https://oagmis.oag.go.tz/portal/constitutions/3/download' },
      WHO_FGM_2025: { name: 'WHO: Health risks of female genital mutilation', url: 'https://www.who.int/teams/sexual-and-reproductive-health-and-research-%28srh%29/areas-of-work/female-genital-mutilation/health-risks-of-female-genital-mutilation' },
      TZA_LMA_2023_AND_GYUMI_2019: { name: 'Law of Marriage Act, Mainland Tanzania', url: 'https://oagmis.oag.go.tz/portal/acts/revised/134/download' },
    };
    const ids = new Set<string>();
    const result: Array<{ id: string; name: string; reference?: string; url?: string }> = [];
    const relevantByIntent: Record<string, string[]> = {
      fgm: ['TZA_LCA_2023', 'WHO_FGM_2025'],
      child_marriage: ['TZA_LMA_2023_AND_GYUMI_2019'],
      hitting_child: ['TZA_LCA_2023'],
      education: ['TZA_CONSTITUTION_OAG_2009', 'TZA_LCA_2023'],
      equality: ['TZA_CONSTITUTION_OAG_2009'],
      constitution_rights: ['TZA_CONSTITUTION_OAG_2009'],
      child_safety: ['TZA_LCA_2023'],
      support: ['WHO_TRAINING_2021', 'WHO_CLINICAL_HANDBOOK_2014', 'TZA_LCA_2023'],
    };
    const allowed = relevantByIntent[intent] ? new Set(relevantByIntent[intent]) : undefined;
    for (const { record } of evidence) {
      const sourceId = typeof record.source_id === 'string' ? record.source_id : undefined;
      const idsForRecord = sourceId ? [sourceId] : Array.isArray(record.source_ids)
        ? record.source_ids.filter((id): id is string => typeof id === 'string')
        : [];
      for (const id of idsForRecord) {
        if (allowed && !allowed.has(id)) continue;
        if (ids.has(id)) continue;
        ids.add(id);
        const source = catalog[id];
        if (!source) continue;
        result.push({
          id,
          name: source.name,
          url: source.url,
        });
        if (result.length >= 4) break;
      }
      if (typeof record.additional_source_url === 'string' && result.length < 4) {
        const courtId = 'TZA_GYUMI_COURT_OF_APPEAL_2019';
        if (!ids.has(courtId)) {
          ids.add(courtId);
          result.push({
            id: courtId,
            name: 'Court of Appeal decision in Rebeca Gyumi',
            url: record.additional_source_url,
          });
        }
      }
    }
    return result;
  }

  private async generateWithConfiguredProvider(
    question: string,
    language: Language,
    evidence: RetrievedKnowledge[],
    safetyRules: Array<{ rule: string; action: string }>,
  ): Promise<Pick<GeneratedAnswer, 'directAnswer' | 'explanation' | 'guidance'> | null> {
    const endpoint = process.env.AI_LLM_API_URL;
    const apiKey = process.env.AI_LLM_API_KEY;
    const model = process.env.AI_LLM_MODEL;
    if (!endpoint || !apiKey || !model || !evidence.length) return null;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are SalamaLine, a safeguarding-first assistant for Mainland Tanzania. Answer in ${language === 'sw' ? 'natural, conversational Kiswahili used in Tanzania' : 'natural, clear English'}. Sound like a knowledgeable and careful person, not a legal document or research report. Start with a direct answer, then explain in ordinary language why it matters and what rights, protections or responsibilities apply. Give practical safe guidance only when useful. Never begin with an article or section number, list provisions, or put citations in the response prose; relevant source names and links are supplied separately by the application. Use only supplied evidence; never invent facts, legal conclusions, contacts or services. When sources conflict or do not cover a jurisdiction, say so plainly. Distinguish Mainland Tanzania from Zanzibar. Do not diagnose, prescribe, blame, pressure disclosure/reporting, encourage confrontation, or claim to contact emergency services. Return JSON with directAnswer, explanation, optional guidance. Keep the answer concise, compassionate and easy to understand.`,
            },
            {
              role: 'user',
              content: JSON.stringify({
                question,
                evidence: evidence.map(({ record, text }) => ({
                  text,
                  source: record.source_title || record.source_ids || 'unattributed knowledge summary',
                  citation: record.citation,
                  verified: record.verified === true,
                  sourceType: record.source_type || record.type,
                  jurisdiction: record.jurisdiction || record.scope,
                })),
                safeguarding: safetyRules,
              }),
            },
          ],
        }),
      });
      if (!response.ok) return null;
      const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = body.choices?.[0]?.message?.content;
      if (!content) return null;
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (typeof parsed.directAnswer !== 'string' || !parsed.directAnswer.trim()) return null;
      return {
        directAnswer: parsed.directAnswer.trim(),
        explanation: typeof parsed.explanation === 'string' ? parsed.explanation.trim() : '',
        guidance: typeof parsed.guidance === 'string' ? parsed.guidance.trim() : undefined,
      };
    } catch {
      // Provider failures silently fall back to the local, evidence-grounded answer.
      return null;
    }
  }

  private isUrgent(question: string): boolean {
    return /niko.{0,12}hatari|yuko.{0,12}hatari|anani(tishia|piga)|right now|immediate danger|being attacked|in danger now/i.test(question);
  }
}
