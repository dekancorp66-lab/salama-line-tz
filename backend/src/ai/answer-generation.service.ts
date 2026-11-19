import { Injectable } from "@nestjs/common";
import OpenAI from "openai";
import { RetrievedKnowledge } from "./knowledge/knowledge-retrieval.service";
import { KnowledgeRecord } from "./knowledge/knowledge-loader.service";

type Language = "sw" | "en";

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
  sources: Array<{
    id: string;
    name: string;
    reference?: string;
    url?: string;
  }>;
  status: "answered" | "no_reliable_answer" | "safety_guidance";
  generatedBy: "grounded_fallback" | "configured_llm";
}

@Injectable()
export class AnswerGenerationService {
  private openai?: OpenAI;

  providerMode(): "openai_with_grounded_fallback" | "grounded_fallback" {
    return this.openAiIsAvailable()
      ? "openai_with_grounded_fallback"
      : "grounded_fallback";
  }
  async generate(
    question: string,
    language: Language,
    retrieved: RetrievedKnowledge[],
    safetyRules: Array<{ rule: string; action: string }>,
    context: Array<{ role: "user" | "assistant"; content: string }> = [],
  ): Promise<GeneratedAnswer> {
    const intent = this.detectIntent(question);
    const evidence = this.relevantEvidence(intent, retrieved);
    const legalIntents = new Set([
      "fgm",
      "child_marriage",
      "hitting_child",
      "education",
      "equality",
      "constitution_rights",
      "constitution_article_12",
      "constitution_article_13",
      "constitution_article_11",
      "disability_education",
      "child_safety",
    ]);
    const legalReferences = legalIntents.has(intent)
      ? this.references(evidence)
      : [];
    const generatedSources =
      ["health_information", "support_directory", "participation"].includes(
        intent,
      )
        ? []
        : this.sources(evidence, intent);
    // A general in-scope answer still needs a visible trail back to the
    // loaded material it was built from.
    const sources =
      intent === "general" &&
      evidence.length &&
      generatedSources.length === 0
        ? [
            {
              id: evidence[0].record.id,
              name:
                evidence[0].record.source_title ||
                evidence[0].record.title ||
                "Loaded SalamaLine guidance",
            },
          ]
        : generatedSources;
    const urgent =
      this.isUrgent(question) ||
      (intent === "health_information" &&
        /severe pain|heavy bleeding|heavy blood loss|maumivu makali|kutokwa damu nyingi|difficulty breathing/i.test(
          question,
        ));

    const llmAnswer = await this.generateWithOpenAi(
      intent,
      question,
      language,
      evidence,
      safetyRules,
      context,
    );
    if (llmAnswer) {
      return {
        ...llmAnswer,
        legalReferences,
        sources,
        status: urgent
          ? "safety_guidance"
          : evidence.length
            ? "answered"
            : "no_reliable_answer",
        generatedBy: "configured_llm",
      };
    }

    const fallback = this.buildGroundedFallback(
      intent,
      question,
      language,
      evidence,
      urgent,
    );
    return {
      ...fallback,
      legalReferences,
      sources,
      status: urgent
        ? "safety_guidance"
        : intent === "health_information" || intent === "support_directory"
          ? "no_reliable_answer"
          : evidence.length
            ? "answered"
            : "no_reliable_answer",
      generatedBy: "grounded_fallback",
    };
  }

  private detectIntent(question: string): string {
    const q = question.toLocaleLowerCase();
    if (/^(hi|hello|hey|habari|hujambo|mambo)[!.?\s]*$/.test(q.trim()))
      return "greeting";
    if (/\b(relative|family|ndugu|jamaa)\b.{0,50}\b(plan|plans|planned|next week|cut|kukata|kukeket|ukeketaji)\b/i.test(q) && /safely|what can i do|nifanye nini|hatari/i.test(q))
      return "fgm_safeguarding";
    if (/\b(zanzibar|zanzibar law|katiba ya zanzibar)\b/.test(q))
      return "jurisdiction_limit";
    const constitutionArticle = q.match(/(?:article|ibara)\s*(\d+)/);
    if (/constitution|constitutional|katiba/.test(q) && constitutionArticle) {
      if (constitutionArticle[1] === "12") return "constitution_article_12";
      if (constitutionArticle[1] === "13") return "constitution_article_13";
      if (constitutionArticle[1] === "11") return "constitution_article_11";
      return "jurisdiction_limit";
    }
    if (/constitution|constitutional|katiba/.test(q) && /education|elimu/.test(q)) return "constitution_article_11";
    if (/constitution|constitutional|katiba/.test(q) && /dignity|utu/.test(q)) return "constitution_article_12";
    if (/constitutional|constitution|katiba/.test(q) && /freedom of expression|uhuru wa kujieleza/i.test(q))
      return "jurisdiction_limit";
    if (/disabilit|ulemavu/.test(q) && /education|school|elimu|shule/.test(q))
      return "disability_education";
    if (/ukeketaji|female genital mutilation|\bfgm\b|genital cutting/.test(q))
      return "fgm";
    if (
      /\b(child|children|mtoto|watoto|girl|sister|daughter|relative)\b.{0,45}\b(cut|cutting|mutilat\w*|kukata|kukeket\w*)\b|\b(cut|cutting)\b.{0,45}\b(sister|daughter|girl|mtoto)\b/i.test(
        q,
      )
    )
      return "fgm";
    if (/afraid|scared|fear|naogopa/.test(q) && /hospital|health|hospitali|kliniki|shambuliw|assault/.test(q)) return "support";
    if (
      /salama.?line.{0,40}(call|contact|notify|emergency)|can you call|contact emergency services|unaweza.{0,35}(kupiga|kuwasiliana).{0,30}(dharura|polisi)/i.test(
        q,
      )
    )
      return "platform_capability";
    if (
      /verified (support )?services|what services.{0,35}available|services.{0,35}in my district|helpline|contact number|orodha iliyothibitishwa|huduma zilizothibitishwa|namba ya simu/i.test(
        q,
      )
    )
      return "support_directory";
    if (
      /\b(kupiga|kupigwa|anampiga|kumpiga)\b|hit(ting)? a child|corporal punishment|humiliat\w*|degrading (?:treatment|punishment)/.test(
        q,
      )
    )
      return "hitting_child";
    if (
      /how can i (?:support|help)|how do i support|what support|what should i do|how should i respond|what safe options|how can .* (?:seek|get) help|ninawezaje kumsaidia|nimsaidieje|nimsaidie|naanzie wapi|kutafuta msaada|help (?:a friend|someone|if)|kumsaidia rafiki|mwenza.*(ukatili|unyanyas)|without (?:pressuring|putting)|bila kumlazimisha|bila kuweka/i.test(
        q,
      )
    )
      return "support";
    if (
      /ndoa.{0,24}(utotoni|mtoto|umri)|(?:mtoto|msichana|girl|child).{0,24}(kuolewa|kuoa|get married|married)|kuolewa.{0,24}umri|child[- ]marriage|marry before 18|marriage before 18|married.{0,10}child|marriage.{0,16}(age|child)|what age.{0,20}marry|(?:family|parent|relative|familia|mzazi|mlezi).{0,55}(pressur\w*|force|shinikiz\w*|lazimish\w*).{0,45}(marry|marriage|kuolewa|ndoa)/.test(
        q,
      )
    )
      return "child_marriage";
    if (
      /\b(neglect|neglected|neglecting|puuzwa|kupuuzwa|kutelekezwa|unyanyas\w*)\b/i.test(
        q,
      )
    )
      return "child_safety";
    if (
      /maoni|views|opinion|participat|ushiriki/i.test(q) &&
      /child|children|mtoto|watoto/i.test(q)
    )
      return "participation";
    if (/\b(elimu|shule|kusoma|school|education|study|kujielimisha)\b/i.test(q))
      return "education";
    if (
      /\b(health|healthcare|medical|clinic|hospital|doctor|nurse|pregnan\w*|menstruat\w*|periods?|reproductive|sexual health|mental health|depression|anxiety|afya|mgonjwa|daktari|hospitali|kliniki|ujauzito|hedhi|uzazi|dalili|dawa|medicine|medication|symptoms?|contracept\w*|bleeding|pain)\b/i.test(
        q,
      )
    )
      return "health_information";
    if (
      /usawa|equality|discrimination|ubaguzi|women'?s rights|haki za wanawake|gender equality/.test(
        q,
      )
    )
      return "equality";
    if (/katiba|constitution|haki za msingi|fundamental rights/.test(q))
      return "constitution_rights";
    if (
      /hatari|danger|unsafe|threat|salama|protection|kulind|ukatili|unyanyas|abuse|violence|neglect|puuzwa/.test(
        q,
      )
    )
      return "child_safety";
    if (/msaada|support|help|huduma|service|respond|someone told me/.test(q))
      return "support";
    return "general";
  }

  private relevantEvidence(
    intent: string,
    retrieved: RetrievedKnowledge[],
  ): RetrievedKnowledge[] {
    const ids: Record<string, string[]> = {
      fgm_safeguarding: ["LCA160", "LCA13", "WHOFGM2025"],
      constitution_article_12: ["CON12"],
      constitution_article_13: ["CON13"],
      constitution_article_11: ["CON11"],
      disability_education: ["CON11", "LCA08"],
      fgm: ["LCA160", "LCA13", "WHOFGM2025", "K001", "K013", "S001", "S002"],
      child_marriage: ["LMA13GYUMI", "CON12", "CON13", "LCA09", "K004", "K020"],
      hitting_child: ["LCA13", "K005", "S001", "S002"],
      education: ["CON11", "LCA08"],
      equality: ["CON12", "CON13"],
      constitution_rights: ["CON11", "CON12", "CON13", "CON14", "CON16"],
      child_safety: [
        "LCA09",
        "LCA13",
        "K005",
        "K006",
        "K007",
        "K013",
        "S001",
        "S002",
      ],
      support: [
        "QA001",
        "K001",
        "K002",
        "K006",
        "K011",
        "K013",
        "S001",
        "S002",
      ],
    };
    if (intent === "health_information") {
      const healthIds = new Set(["QA003", "K009", "K010", "QA008"]);
      return retrieved
        .filter((item) => healthIds.has(item.record.id))
        .slice(0, 4);
    }
    if (intent === "jurisdiction_limit") return [];
    if (intent === "participation") {
      return retrieved.filter((item) => item.record.id === "K019");
    }
    if (intent === "support_directory") {
      return retrieved.filter((item) => item.record.id === "QA008");
    }
    const preferred = ids[intent];
    if (!preferred)
      return retrieved.filter((item) => item.score >= 0.32).slice(0, 4);
    const byId = new Map(retrieved.map((item) => [item.record.id, item]));
    return preferred
      .map((id) => byId.get(id))
      .filter((item): item is RetrievedKnowledge => Boolean(item));
  }

  private buildGroundedFallback(
    intent: string,
    question: string,
    language: Language,
    evidence: RetrievedKnowledge[],
    urgent: boolean,
  ): Pick<GeneratedAnswer, "directAnswer" | "explanation" | "guidance"> {
    const has = (id: string) => evidence.some((item) => item.record.id === id);
    const sw = language === "sw";
    const asksWhyFgm =
      intent === "fgm" &&
      /kwa nini|sababu|madhara|hatari|why|harm|risk/i.test(question);
    const asksFgmEffects =
      intent === "fgm" && /health risks|health effects|madhara ya kiafya|long.term|mental health/i.test(question);
    if (urgent && intent === "health_information") {
      return {
        directAnswer: sw
          ? "Maumivu makali pamoja na kutokwa damu nyingi vinahitaji tathmini ya haraka ya ana kwa ana na mhudumu wa afya."
          : "Severe pain together with heavy bleeding needs urgent in-person assessment by a qualified health professional.",
        explanation: sw
          ? "Siwezi kutambua chanzo au kuagiza dawa. Ikiwezekana, mwombe mtu unayemwamini akusaidie kufika kwenye kituo cha afya."
          : "I cannot identify the cause or prescribe medication. If possible, ask someone you trust to help you reach a health facility.",
        guidance: sw
          ? "SalamaLine haiwezi kupiga simu za dharura kwa niaba yako; huhitaji kushiriki jina au anwani hapa."
          : "SalamaLine cannot place emergency calls for you; you do not need to share your name or address here.",
      };
    }
    if (urgent) {
      return {
        directAnswer: sw
          ? "Ikiwa kuna hatari ya sasa, tafuta sehemu salama ukiweza na wasiliana na mtu unayemwamini au mamlaka husika."
          : "If there is immediate danger, move to a safer place if possible and contact someone you trust or an appropriate local authority.",
        explanation: sw
          ? "SalamaLine haiwezi kupiga simu au kuwasiliana na huduma za dharura kwa niaba yako. Huhitaji kushiriki jina au maelezo zaidi hapa."
          : "SalamaLine cannot call or contact emergency services on your behalf. You do not need to share your name or more details here.",
        guidance: sw
          ? "Ikiwa unaweza, usimkabili mtu anayesababisha hatari; mwombe mtu mzima unayemwamini akae nawe au akusaidie kufika sehemu salama."
          : "If you can, do not confront the person causing the danger; ask a trusted adult to stay with you or help you reach a safer place.",
      };
    }
    if (intent === "platform_capability") {
      return {
        directAnswer: sw
          ? "Hapana. SalamaLine haiwezi kuwasiliana na polisi au huduma za dharura kwa niaba yako."
          : "No. SalamaLine cannot contact the police or emergency services on your behalf.",
        explanation: sw
          ? "Ikiwa kuna hatari ya sasa, tafuta sehemu salama na umwombe mtu unayemwamini au mamlaka husika akusaidie."
          : "If there is immediate danger, move to a safer place and ask someone you trust or an appropriate local authority for help.",
      };
    }
    if (intent === "support_directory") {
      return {
        directAnswer: sw
          ? "Sina orodha iliyothibitishwa ya huduma na mawasiliano kwa wilaya yako, hivyo sitabuni namba au kituo."
          : "I do not have a verified directory of support services and contacts for your district, so I will not invent a number or facility.",
        explanation: sw
          ? "Tafuta uthibitisho kutoka chanzo rasmi cha eneo lako. Huhitaji kuweka jina au anwani yako hapa."
          : "Check an official local source to verify current services. You do not need to share your name or address here.",
      };
    }
    if (intent === "health_information") {
      const asksForFacility =
        /clinic|hospital|health centre|health center|nearby|near me|kituo cha afya|hospitali|kliniki|karibu nami/i.test(
          question,
        );
      const asksForDiagnosisOrMedication =
        /diagnos|what illness|what disease|what condition|dawa|medicine|medication|prescrib|dozi|ugonjwa gani/i.test(
          question,
        );
      return {
        directAnswer: sw
          ? asksForFacility
            ? "Sina orodha iliyothibitishwa ya vituo vya afya na upatikanaji wake kwa eneo lako, hivyo sitataja kituo nisichoweza kuthibitisha."
            : "Naweza kutoa taarifa za afya za jumla tu; siwezi kuchunguza, kutambua ugonjwa au kuagiza dawa."
          : asksForFacility
            ? "I do not have a verified directory of nearby health facilities or their current availability, so I cannot safely name one."
            : "I can provide general health information, but I cannot examine you, diagnose a condition, or prescribe medication.",
        explanation: sw
          ? asksForDiagnosisOrMedication
            ? "Kwa dalili au dawa, zungumza na mhudumu wa afya aliyehitimu ili apime hali yako kwa mwongozo wa sasa wa Tanzania Bara."
            : asksForFacility
              ? "Thibitisha kituo kupitia chanzo rasmi cha afya cha eneo lako au mhudumu wa afya. Huhitaji kushiriki jina au anwani yako hapa."
              : "Sina mwongozo wa sasa uliothibitishwa kuhusu swali hili maalumu; mhudumu wa afya aliyehitimu anaweza kukupa taarifa inayofaa."
          : asksForDiagnosisOrMedication
            ? "For symptoms or medication, speak with a qualified health professional who can assess you using current Mainland Tanzania guidance."
            : asksForFacility
              ? "Check with an official local health authority or a qualified health professional to verify a facility and its availability. You do not need to share your name or exact address here."
              : "I do not have current, verified guidance for this specific health question; a qualified health professional can provide information suited to your situation.",
      };
    }
    if (!evidence.length) {
      if (intent === "jurisdiction_limit") {
        return {
          directAnswer: sw
            ? "Sina vyanzo vya sasa vilivyothibitishwa vinavyotosha kujibu swali hili kuhusu Zanzibar."
            : "I do not have enough current, verified sources to answer this question about Zanzibar.",
          explanation: sw
            ? "Sitachukulia sheria za Tanzania Bara kuwa zinatumika Zanzibar wala kubuni kifungu. Tafuta chanzo rasmi cha Zanzibar au ushauri wa mtaalamu wa sheria."
            : "I will not assume Mainland Tanzania law applies in Zanzibar or invent a legal provision. Check an official Zanzibar source or a qualified legal professional.",
        };
      }
      if (urgent) {
        return {
          directAnswer: sw
            ? "Ikiwa uko kwenye hatari ya sasa, jaribu kuelekea sehemu salama na utafute msaada wa mtu halisi."
            : "If you are in immediate danger, try to move to a safer place and seek help from a real person.",
          explanation: sw
            ? "Huhitaji kushiriki maelezo binafsi hapa. SalamaLine AI haiwezi kuwasiliana na huduma za dharura kwa niaba yako."
            : "You do not need to share personal details here. SalamaLine AI cannot contact emergency services on your behalf.",
          guidance: sw
            ? "Ikiwezekana, wasiliana na mtu mzima unayemwamini au huduma husika ya ulinzi katika eneo lako. Usimkabili mtu anayekuweka hatarini."
            : "If possible, contact a trusted adult or an appropriate local protection service. Do not confront someone who is putting you at risk.",
        };
      }
      if (intent === "support" || intent === "child_safety") {
        const self = this.isSelfFocused(question);
        return {
          directAnswer: sw
            ? self
              ? "Pole kwa hali hii. Unaweza kuzungumza na mtu mzima unayemwamini au afisa ustawi wa jamii; si lazima usimulie kila kitu hapa."
              : "Pole kwa hali hii. Mtu anayehitaji msaada anaweza kuzungumza na mtu mzima anayemwamini au afisa ustawi wa jamii; si lazima asimulie kila kitu hapa."
            : self
              ? "I’m sorry this is happening. You can speak with a trusted adult or social welfare officer; you do not need to share all the details here."
              : "I’m sorry this is happening. The person can speak with a trusted adult or social welfare officer; they do not need to share all the details here.",
          explanation: sw
            ? "Sina ushahidi wa kutosha kuthibitisha huduma maalumu katika eneo lako, na sitabuni mawasiliano."
            : "I do not have enough verified information to name a local service, and I will not invent contact details.",
        };
      }
      return {
        directAnswer: sw
          ? "Sina ushahidi wa kutosha kwenye vyanzo vilivyopakiwa kujibu swali hili kwa uhakika."
          : "I do not have enough evidence in the loaded sources to answer this reliably.",
        explanation: sw
          ? "Sitaki kubuni taarifa au rejea za kisheria. Unaweza kuuliza kuhusu haki za watoto, ulinzi, elimu au msaada unaotokana na vyanzo vilivyopakiwa."
          : "I will not invent information or legal references. You can ask about child rights, protection, education, or support covered by the loaded sources.",
      };
    }

    switch (intent) {
      case "fgm_safeguarding":
        return {
          directAnswer: sw
            ? "Pole kwa hali hii. Kipaumbele ni usalama wa dada yako; mshirikishe mtu mzima anayeaminika au afisa ustawi wa jamii haraka."
            : "I’m sorry this is happening. Prioritize your sister’s safety and tell a trusted adult or social welfare officer as soon as it is safe.",
          explanation: sw
            ? "Usimkabili ndugu anayepanga kumdhuru. Usimlazimishe dada yako kutoa maelezo; huhitaji kuweka majina au taarifa binafsi hapa."
            : "Do not confront the relative who plans to harm her. Do not pressure your sister to disclose details; you do not need to share names or identifying information here.",
        };
      case "greeting":
        return {
          directAnswer: sw
            ? "Habari! Naweza kusaidia kujibu maswali kuhusu haki, usalama na ulinzi."
            : "Hello! I can help with questions about rights, safety and protection.",
          explanation: "",
        };
      case "participation":
        return {
          directAnswer: sw
            ? "Muhtasari wa sera uliopakiwa unasema watoto washiriki kwa maana katika mipango na huduma kwa njia inayozingatia umri na uwezo wao."
            : "The loaded policy summary says children should participate meaningfully in planning and services in ways appropriate to their age and understanding.",
          explanation: sw
            ? "Muhtasari huu hautoshi kuthibitisha kifungu maalumu cha sheria kuhusu hali fulani, kwa hiyo sitataja kifungu cha kisheria."
            : "This summary does not establish a specific statutory provision for an individual case, so I will not claim a legal section or article.",
        };
      case "fgm":
        return {
          directAnswer: asksFgmEffects
            ? sw
              ? "Ukeketaji unaweza kusababisha madhara ya kiafya na kisaikolojia ya muda mfupi au mrefu."
              : "FGM can cause short- or long-term physical and psychological health effects."
            : asksWhyFgm
            ? sw
              ? "Hapana. Ukeketaji hauna faida yoyote ya kiafya. Unaweza kusababisha madhara kwa afya na ustawi wa mtoto wa kike."
              : "No. FGM has no health benefit. It can harm a girl’s health and wellbeing."
            : sw
              ? "Hapana. Ukeketaji wa mtoto wa kike haupaswi kufanywa."
              : "No. Female genital mutilation should not be performed on a girl who is a child.",
          explanation: sw
            ? [
                has("WHOFGM2025")
                  ? "Mwongozo wa WHO unaeleza kuwa ukeketaji hauna faida ya kiafya na unaweza kudhuru afya na ustawi."
                  : "",
                has("LCA160") || has("LCA13")
                  ? "Mtoto ana haki ya kulindwa dhidi ya vitendo na mila zinazoweza kumdhuru; watu wazima wana wajibu wa kusaidia kulinda afya, usalama na utu wake."
                  : "",
              ]
                .filter(Boolean)
                .join(" ")
            : [
                has("WHOFGM2025")
                  ? "WHO guidance explains that FGM has no health benefit and can harm health and wellbeing."
                  : "",
                has("LCA160") || has("LCA13")
                  ? "Children have a right to protection from harmful practices, and adults have a responsibility to protect their health, safety and dignity."
                  : "",
              ]
                .filter(Boolean)
                .join(" "),
          guidance: sw
            ? "Ikiwa mtoto anaweza kuwa kwenye hatari, anaweza kutafuta msaada kutoka kwa mtu mzima anayemwamini, afisa ustawi wa jamii au mamlaka ya eneo. Usimlazimishe kueleza zaidi au kumkabili mtu anayemweka hatarini."
            : "If a child may be at risk, they can seek help from a trusted adult, a social welfare officer, or a local authority. Do not pressure the child to disclose more or confront someone who may put them at risk.",
        };
      case "child_marriage":
        return {
          directAnswer: sw
            ? "Kwa Tanzania Bara, msimamo wa Mahakama ya Rufani ni kwamba umri wa chini wa ndoa ni miaka 18 kwa wote."
            : "For Mainland Tanzania, the Court of Appeal’s position is that the minimum marriage age is 18 for everyone.",
          explanation: sw
            ? "Hata hivyo, maandishi ya sheria ya ndoa yaliyopo kwenye vyanzo hivi bado yana vifungu vinavyoonyesha umri tofauti, hivyo hali ya kisheria ina utata. Vyanzo hivi vinahusu Tanzania Bara; havitoshi kuthibitisha sheria ya Zanzibar. Kwa uamuzi kuhusu hali maalumu, tafuta ushauri wa kisheria unaotegemea taarifa za sasa."
            : "However, the marriage law text in these sources still contains provisions with different ages, so the legal position is complicated. These sources cover Mainland Tanzania and do not establish Zanzibar law. For a specific situation, seek legal advice based on current information.",
          guidance: sw
            ? "Ikiwa mtoto anakabiliwa na shinikizo au hatari, anaweza kuzungumza na mtu mzima anayemwamini au afisa ustawi wa jamii. Usimlazimishe kuripoti au kukabiliana na mtu anayemshinikiza."
            : "If a child is facing pressure or danger, they can speak with a trusted adult or social welfare officer. Do not force them to report or confront the person pressuring them.",
        };
      case "hitting_child":
        return {
          directAnswer: sw
            ? "Hapana—mtoto hastahili kuumizwa au kudhalilishwa kama adhabu."
            : "No—a child should not be hurt or degraded as punishment.",
          explanation: sw
            ? "Mtoto anastahili kurekebishwa kwa njia inayozingatia umri na hali yake, bila ukatili au udhalilishaji. Kulinda afya na utu wa mtoto ni wajibu wa watu wazima; tukio maalumu linahitaji kuchunguzwa na mtu anayestahili."
            : "Discipline should take a child’s age and circumstances into account and must not be cruel or degrading. Adults are responsible for protecting a child’s health and dignity; a specific incident should be assessed by an appropriate professional.",
          guidance: sw
            ? "Ikiwa mtoto ameumizwa au yuko hatarini, msaada unaweza kutafutwa kutoka kwa mtu mzima anayeaminika au afisa ustawi wa jamii. Mtoto hapaswi kulaumiwa."
            : "If a child has been hurt or is at risk, help can be sought from a trusted adult or social welfare officer. The child should not be blamed.",
        };
      case "education": {
        const pregnancySpecific =
          /pregnan|ujauzito|mjamzito|expelled|fukuzwa shule/i.test(question);
        return {
          directAnswer: sw
            ? "Ndiyo. Mtoto ana haki ya kupata elimu."
            : "Yes. A child has a right to education.",
          explanation: sw
            ? `Wajibu wa matunzo ya mzazi au mlezi unajumuisha elimu, na mtoto hapaswi kunyimwa fursa ya kusoma.${pregnancySpecific ? " Vyanzo vilivyopakiwa havithibitishi utaratibu wa sasa wa kuendelea au kurudi shule baada ya ujauzito; usihitimishe utaratibu huo kutokana na haki ya jumla ya elimu pekee." : ""}`
            : `A parent’s or guardian’s duty to maintain a child includes education, and a child should not be deprived of access to education.${pregnancySpecific ? " The loaded sources do not verify the current procedure for continuing or returning to school after pregnancy; the general right to education alone does not establish that procedure." : ""}`,
          guidance: pregnancySpecific
            ? sw
              ? "Tafuta mwongozo wa sasa kutoka mamlaka husika ya elimu au mtaalamu wa sheria; usishiriki taarifa zinazomtambulisha mtoto hapa."
              : "Check current guidance from the relevant education authority or a qualified legal professional; do not share identifying details about the child here."
            : undefined,
        };
      }
      case "disability_education":
        return {
          directAnswer: sw
            ? "Mtoto hapaswi kunyimwa fursa ya kupata elimu."
            : "A child should not be deprived of access to education.",
          explanation: sw
            ? "Vyanzo vilivyopakiwa vinathibitisha haki ya mtoto kupata elimu, lakini havielezi kwa kina marekebisho au huduma maalumu kwa ulemavu. Tafuta mwongozo kutoka mamlaka ya elimu au mtaalamu anayefaa."
            : "The loaded sources support a child’s access to education, but do not set out detailed disability accommodations or services. Check with the relevant education authority or a qualified professional.",
        };
      case "jurisdiction_limit":
        return {
          directAnswer: sw
            ? "Sina vyanzo vya sasa vilivyothibitishwa vinavyotosha kujibu swali hili kuhusu Zanzibar."
            : "I do not have enough current, verified sources to answer this question about Zanzibar.",
          explanation: sw
            ? "Sitachukulia sheria za Tanzania Bara kuwa zinatumika Zanzibar wala kubuni kifungu. Tafuta chanzo rasmi cha Zanzibar au ushauri wa mtaalamu wa sheria."
            : "I will not assume Mainland Tanzania law applies in Zanzibar or invent a legal provision. Check an official Zanzibar source or a qualified legal professional.",
        };
      case "constitution_article_12":
      case "constitution_article_13":
      case "constitution_article_11": {
        const content = intent.endsWith("12")
          ? sw
            ? "Ibara ya 12 inasema binadamu wote huzaliwa huru na sawa na kila mtu anastahili kutambuliwa na kuheshimiwa utu wake."
            : "Article 12 says all human beings are born free and equal and are entitled to recognition and respect for their dignity."
          : intent.endsWith("13")
            ? sw
              ? "Ibara ya 13 inasema watu wote ni sawa mbele ya sheria na wanastahili kulindwa na kupata haki sawa bila ubaguzi."
              : "Article 13 says all persons are equal before the law and are entitled to protection and equality before the law without discrimination."
            : sw
              ? "Ibara ya 11 inatambua haki ya kupata elimu na inaeleza wajibu wa Serikali kuhusu fursa za elimu na mafunzo."
              : "Article 11 recognizes the right to education and sets out the Government’s duty regarding educational and vocational opportunities.";
        return { directAnswer: content, explanation: "" };
      }
      case "equality":
        return {
          directAnswer: sw
            ? "Katiba inasema binadamu wote huzaliwa huru na sawa."
            : "The Constitution says all human beings are born free and equal.",
          explanation: sw
            ? "Hii ina maana kila mtu anastahili heshima na kutendewa kwa usawa. Ulinzi huo ni muhimu ili watu wasinyimwe haki au fursa kwa sababu ya jinsia, hali au asili yao."
            : "That means everyone deserves dignity and equal treatment. These protections matter so people are not denied rights or opportunities because of their gender, circumstances or background.",
        };
      case "constitution_rights":
        return {
          directAnswer: sw
            ? "Katiba inatambua haki za msingi na wajibu katika Sehemu ya Tatu ya Sura ya Kwanza."
            : "The Constitution recognizes basic rights and duties in Part III of Chapter One.",
          explanation: sw
            ? "Kwa ujumla, zinahakikisha watu wanaheshimiwa, wanalindwa na wanapata nafasi ya kushiriki katika maisha ya jamii. Haki maalumu na namna zinavyotumika hutegemea hali na sheria husika."
            : "In everyday terms, they help ensure people are treated with dignity, protected and able to participate in society. Which specific right applies depends on the situation and relevant law.",
        };
      case "child_safety":
        return {
          directAnswer: sw
            ? "Ndiyo. Mtoto ana haki ya kulindwa dhidi ya ukatili na unyanyasaji."
            : "Yes. A child has a right to protection from violence and abuse.",
          explanation: sw
            ? "Ulinzi huu ni muhimu kwa afya, usalama na ukuaji wa mtoto. Watu wazima wana jukumu la kumsaidia na kumkinga dhidi ya madhara."
            : "This protection matters for a child’s health, safety and development. Adults have a responsibility to help keep children safe from harm.",
          guidance: urgent
            ? sw
              ? "Ikiwa hatari ni ya sasa, tafuta sehemu salama ikiwa unaweza na wasiliana na mtu mzima unayemwamini, afisa ustawi wa jamii au mamlaka husika. Si lazima utoe maelezo zaidi hapa; usimkabili mtu anayesababisha hatari."
              : "If the danger is immediate, move to a safer place if possible and contact a trusted adult, social welfare officer, or appropriate local authority. You do not need to share more here; do not confront the person causing the risk."
            : sw
              ? "Mtoto anaweza kuomba msaada kutoka kwa mtu mzima anayemwamini, afisa ustawi wa jamii au mamlaka ya eneo. Si lazima asimulie kila kitu au achukue hatua peke yake."
              : "A child can seek help from a trusted adult, social welfare officer, or local authority. They do not need to tell every detail or handle the situation alone.",
        };
      case "support": {
        const qa = evidence.find(
          (item) => item.record.id.startsWith("QA") && item.score >= 0.65,
        )?.record;
        const answer = qa?.[language === "sw" ? "answer_sw" : "answer_en"];
        const self = this.isSelfFocused(question);
        return {
          directAnswer:
            typeof answer === "string"
              ? answer
              : sw
                ? self
                  ? "Unastahili kusikilizwa na kuaminiwa. Mwambie mtu mzima unayemwamini au afisa ustawi wa jamii kile unachojisikia salama kusema; si kosa lako."
                  : "Msikilize bila kumhukumu, mwambie kwamba si kosa lake, na muulize anahitaji msaada gani sasa."
                : self
                  ? "You deserve to be heard and believed. Tell a trusted adult or social welfare officer only what you feel safe sharing; it is not your fault."
                  : "Listen without judgment, reassure them that they are not to blame, and ask what support they need now.",
          explanation: sw
            ? "Mtu mzima unayemwamini, afisa ustawi wa jamii au mamlaka husika wanaweza kusaidia. Chagua unachojisikia salama kufanya; si lazima utoe taarifa binafsi hapa."
            : "A trusted adult, social welfare officer, or appropriate local authority may be able to help. Choose what feels safe; you do not need to share personal details here.",
          guidance: urgent
            ? sw
              ? "Kama hatari ni ya sasa, tafuta sehemu salama na uwasiliane na mtu mzima unayemwamini au mamlaka husika. SalamaLine AI haiwezi kuwasiliana na huduma za dharura kwa niaba yako."
              : "If danger is immediate, move to a safer place and contact a trusted adult or appropriate local authority. SalamaLine AI cannot contact emergency services for you."
            : /pressur|force|threat|lazimish|shinikiz|threaten|plans to/i.test(question)
              ? sw
                ? "Usimkabili mtu anayesababisha shinikizo au hatari. Si lazima uripoti au utoe maelezo zaidi hapa."
                : "Do not confront the person causing pressure or danger. You do not have to report or share more details here."
            : undefined,
        };
      }
      default: {
        const qa = evidence.find(
          (item) => item.record.id.startsWith("QA") && item.score >= 0.65,
        )?.record;
        const qaAnswer = qa?.[language === "sw" ? "answer_sw" : "answer_en"];
        if (typeof qaAnswer === "string")
          return { directAnswer: qaAnswer, explanation: "" };
        const grounded = this.generalEvidenceAnswer(language, evidence);
        if (grounded) return grounded;
        return {
          directAnswer: sw
            ? "Sina taarifa za kutosha zilizothibitishwa kujibu swali hili kwa uhakika."
            : "I do not have enough verified information to answer this reliably.",
          explanation: sw
            ? "Sitaki kubuni jibu. Unaweza kuuliza kuhusu ulinzi wa mtoto, elimu, usalama au njia za kupata msaada."
            : "I do not want to guess. You can ask about child protection, education, safety, or ways to find support.",
        };
      }
    }
  }

  /**
   * Turn otherwise-unhandled but genuinely relevant evidence into a useful,
   * clearly attributed answer instead of a blanket refusal. Legal citations
   * are removed here because the reference list, not free text, owns them.
   */
  private generalEvidenceAnswer(
    language: Language,
    evidence: RetrievedKnowledge[],
  ): Pick<GeneratedAnswer, "directAnswer" | "explanation"> | null {
    const usable = evidence
      .filter((item) => typeof item.text === "string" && item.text.trim())
      .sort((a, b) => {
        const aVerified = a.record.verified === true ? 1 : 0;
        const bVerified = b.record.verified === true ? 1 : 0;
        return bVerified - aVerified || b.score - a.score;
      });
    const best = usable[0];
    if (!best) return null;
    const snippet = best.text
      .replace(/\b(?:article|section|ibara|kifungu)\s+\d+[\w().–-]*/gi, "")
      .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 380);
    if (snippet.length < 25) return null;
    return {
      directAnswer:
        language === "sw"
          ? `Taarifa iliyopakiwa inasema: ${snippet}`
          : `The loaded guidance says: ${snippet}`,
      explanation:
        language === "sw"
          ? "Hii ni taarifa ya jumla kutoka chanzo kilichothibitishwa. Kwa hali yako maalumu, zungumza na mtaalamu au mamlaka husika; huhitaji kushiriki taarifa binafsi hapa."
          : "This is general information from a verified source. For your specific situation, speak with an appropriate professional or authority; you do not need to share personal details here.",
    };
  }

  private references(evidence: RetrievedKnowledge[]): AiReference[] {
    const unique = new Map<string, AiReference>();
    for (const { record } of evidence) {
      const legalTypes = [
        "constitution",
        "legislation",
        "legislation_and_case_law",
      ];
      if (
        !record.citation ||
        record.verified !== true ||
        typeof record.source_title !== "string" ||
        !legalTypes.includes(String(record.source_type))
      )
        continue;
      const reference: AiReference = {
        source: record.source_title,
        reference: record.citation,
        verified: record.verified === true,
        jurisdiction:
          typeof record.jurisdiction === "string"
            ? record.jurisdiction
            : undefined,
        url:
          typeof record.source_url === "string" ? record.source_url : undefined,
        note:
          typeof record.verification_note === "string"
            ? record.verification_note
            : undefined,
      };
      unique.set(`${reference.source}|${reference.reference}`, reference);
      if (
        typeof record.additional_source_url === "string" &&
        !/Civil Appeal No\. 204 of 2017/i.test(String(record.citation))
      ) {
        unique.set(`${reference.source}|Court of Appeal judgment`, {
          source: record.source_title,
          reference:
            "Court of Appeal judgment, Civil Appeal No. 204 of 2017, delivered 23 October 2019",
          verified: true,
          jurisdiction:
            typeof record.jurisdiction === "string"
              ? record.jurisdiction
              : undefined,
          url: record.additional_source_url,
        });
      }
    }
    return [...unique.values()];
  }

  private sources(evidence: RetrievedKnowledge[], intent: string) {
    const catalog: Record<string, { name: string; url?: string }> = {
      WHO_TRAINING_2021: {
        name: "WHO: Caring for women subjected to violence",
        url: "https://www.who.int/publications/i/item/9789240039803",
      },
      TZA_LCA_2023: {
        name: "Sheria ya Mtoto ya Tanzania Bara (Law of the Child Act)",
        url: "https://oagmis.oag.go.tz/portal/acts/revised/555/download",
      },
      WHO_CLINICAL_HANDBOOK_2014: {
        name: "WHO: Clinical handbook on care for women subjected to violence",
        url: "https://www.who.int/publications/i/item/WHO-RHR-14.26",
      },
      TZA_NPA_VAWC_II_2024_2029: {
        name: "National Plan of Action to End Violence Against Women and Children II",
      },
      TZA_CONSTITUTION_OAG_2009: {
        name: "Katiba ya Jamhuri ya Muungano wa Tanzania",
        url: "https://oagmis.oag.go.tz/portal/constitutions/3/download",
      },
      WHO_FGM_2025: {
        name: "WHO: Health risks of female genital mutilation",
        url: "https://www.who.int/teams/sexual-and-reproductive-health-and-research-%28srh%29/areas-of-work/female-genital-mutilation/health-risks-of-female-genital-mutilation",
      },
      TZA_LMA_2023_AND_GYUMI_2019: {
        name: "Law of Marriage Act, Mainland Tanzania",
        url: "https://oagmis.oag.go.tz/portal/acts/revised/134/download",
      },
    };
    const ids = new Set<string>();
    const result: Array<{
      id: string;
      name: string;
      reference?: string;
      url?: string;
    }> = [];
    const relevantByIntent: Record<string, string[]> = {
      fgm: ["TZA_LCA_2023", "WHO_FGM_2025"],
      child_marriage: ["TZA_LMA_2023_AND_GYUMI_2019"],
      hitting_child: ["TZA_LCA_2023"],
      education: ["TZA_CONSTITUTION_OAG_2009", "TZA_LCA_2023"],
      equality: ["TZA_CONSTITUTION_OAG_2009"],
      constitution_rights: ["TZA_CONSTITUTION_OAG_2009"],
      constitution_article_12: ["TZA_CONSTITUTION_OAG_2009"],
      constitution_article_13: ["TZA_CONSTITUTION_OAG_2009"],
      constitution_article_11: ["TZA_CONSTITUTION_OAG_2009"],
      disability_education: ["TZA_CONSTITUTION_OAG_2009", "TZA_LCA_2023"],
      child_safety: ["TZA_LCA_2023"],
      support: [
        "WHO_TRAINING_2021",
        "WHO_CLINICAL_HANDBOOK_2014",
        "TZA_LCA_2023",
      ],
      health_information: ["WHO_CLINICAL_HANDBOOK_2014", "WHO_TRAINING_2021"],
    };
    const allowed = relevantByIntent[intent]
      ? new Set(relevantByIntent[intent])
      : undefined;
    for (const { record } of evidence) {
      const isLegalSource = [
        "constitution",
        "legislation",
        "legislation_and_case_law",
      ].includes(String(record.source_type));
      if (isLegalSource && record.verified !== true) continue;
      const sourceId =
        typeof record.source_id === "string" ? record.source_id : undefined;
      const idsForRecord = sourceId
        ? [sourceId]
        : Array.isArray(record.source_ids)
          ? record.source_ids.filter(
              (id): id is string => typeof id === "string",
            )
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
      if (
        typeof record.additional_source_url === "string" &&
        result.length < 4
      ) {
        const courtId = "TZA_GYUMI_COURT_OF_APPEAL_2019";
        if (!ids.has(courtId)) {
          ids.add(courtId);
          result.push({
            id: courtId,
            name: "Court of Appeal decision in Rebeca Gyumi",
            url: record.additional_source_url,
          });
        }
      }
    }
    return result;
  }

  private async generateWithOpenAi(
    intent: string,
    question: string,
    language: Language,
    evidence: RetrievedKnowledge[],
    safetyRules: Array<{ rule: string; action: string }>,
    context: Array<{ role: "user" | "assistant"; content: string }>,
  ): Promise<Pick<
    GeneratedAnswer,
    "directAnswer" | "explanation" | "guidance"
  > | null> {
    if (!this.openAiIsAvailable() || this.mustStayLocal(question, intent))
      return null;

    const verifiedEvidence = evidence.filter(
      ({ record }) => record.verified === true,
    );
    if (!verifiedEvidence.length) return null;

    try {
      this.openai ||= new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 12_000,
        maxRetries: 1,
      });
      const response = await this.openai.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-6-luna",
        instructions: `You are SalamaLine, a safeguarding-first educational assistant for Mainland Tanzania. Answer in ${language === "sw" ? "natural, conversational Kiswahili used in Tanzania" : "natural, clear English"}. Use only the supplied verified evidence. Answer the topic directly and clearly, in a few short sentences. Do not invent facts, legal conclusions, constitutional articles, sections, helplines, contacts, or services. Distinguish Mainland Tanzania from Zanzibar. Do not diagnose, prescribe, blame, pressure disclosure/reporting, encourage confrontation, or claim to contact emergency services. Explain uncertainty or conflicting sources plainly. Keep the answer age-appropriate. Return only JSON matching the required schema.`,
        // Never transmit the raw question. It may contain a child's name,
        // contact details, health data, or sensitive case disclosure.
        input: JSON.stringify({
          topic: intent,
          // Short, redacted history helps the provider resolve "what if she is
          // 14?" style follow-ups against the subject already under discussion.
          conversation: context.slice(-4).map(({ role, content }) => ({
            role,
            content: this.minimizeProviderQuery(content).slice(0, 400),
          })),
          evidence: verifiedEvidence.map(({ record, text }) => ({
            text: text.slice(0, 1800),
            source:
              record.source_title ||
              record.source_ids ||
              "unattributed knowledge summary",
            citation: record.citation,
            verified: record.verified === true,
            jurisdiction: record.jurisdiction || record.scope,
          })),
          safeguarding: safetyRules,
        }),
        text: {
          format: {
            type: "json_schema",
            name: "salamaline_answer",
            strict: true,
            schema: {
              type: "object",
              properties: {
                directAnswer: { type: "string" },
                explanation: { type: "string" },
                guidance: { type: ["string", "null"] },
              },
              required: ["directAnswer", "explanation", "guidance"],
              additionalProperties: false,
            },
          },
        },
        store: false,
        max_output_tokens: 500,
      });
      const content = response.output_text;
      if (!content) return null;
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (
        typeof parsed.directAnswer !== "string" ||
        !parsed.directAnswer.trim() ||
        parsed.directAnswer.length > 600 ||
        typeof parsed.explanation !== "string" ||
        parsed.explanation.length > 1200 ||
        (parsed.guidance !== null && typeof parsed.guidance !== "string") ||
        (typeof parsed.guidance === "string" && parsed.guidance.length > 800)
      )
        return null;
      const outputText = [
        parsed.directAnswer,
        typeof parsed.explanation === "string" ? parsed.explanation : "",
        typeof parsed.guidance === "string" ? parsed.guidance : "",
      ].join("\n");
      const claimedProvisions = [
        ...outputText.matchAll(
          /\b(?:article|section|ibara|kifungu)\s+\d+[\w().–-]*/gi,
        ),
      ].map((match) => match[0].toLocaleLowerCase());
      const verifiedReferences = this.references(evidence);
      const provisionsAreGrounded = claimedProvisions.every((claim) =>
        verifiedReferences.some((reference) =>
          reference.reference.toLocaleLowerCase().includes(claim),
        ),
      );
      if (!provisionsAreGrounded) return null;
      const moderation = await this.openai.moderations.create({
        model: "omni-moderation-latest",
        input: outputText,
      });
      if (moderation.results.some((result) => result.flagged)) return null;
      return {
        directAnswer: parsed.directAnswer.trim(),
        explanation: parsed.explanation.trim(),
        guidance: typeof parsed.guidance === "string" ? parsed.guidance.trim() : undefined,
      };
    } catch {
      // Provider failures silently fall back to the local, evidence-grounded answer.
      return null;
    }
  }

  private openAiIsAvailable(): boolean {
    const enabled =
      process.env.OPENAI_ENABLED === "true" &&
      Boolean(process.env.OPENAI_API_KEY);
    // Local development can exercise the provider with synthetic/general
    // questions. Production stays off until the organization confirms the
    // under-18 safeguards and eligibility.
    return enabled &&
      (process.env.NODE_ENV !== "production" ||
        process.env.OPENAI_MINOR_SAFEGUARDS_CONFIRMED === "true");
  }

  private mustStayLocal(question: string, intent: string): boolean {
    const providerEligibleIntents = new Set([
      "education",
      "disability_education",
      "equality",
      "constitution_rights",
      "constitution_article_11",
      "constitution_article_12",
      "constitution_article_13",
      "fgm",
      "child_marriage",
      "hitting_child",
      "health_information",
      "participation",
    ]);
    if (!providerEligibleIntents.has(intent) || this.isUrgent(question))
      return true;

    // Personal, case-specific, and symptom-specific requests stay local even
    // when their topic is otherwise eligible for general educational answers.
    const personalContext =
      /\b(?:i|me|my|mine|we|us|our|my friend|my sister|my daughter|my child|my family|my partner|my husband|my wife|someone told me|she told me|he told me|nime|nina|kwangu|yangu|dada yangu|mtoto wangu|rafiki yangu|familia yangu)\b/i.test(
        question,
      );
    const healthCase =
      intent === "health_information" &&
      /\b(?:symptom|diagnos|what illness|what disease|what condition|treat|treatment|medicine|medication|prescrib|dose|dozi|dalili|ugonjwa gani|nitumie dawa|tumia dawa)\b/i.test(
        question,
      );
    const caseDisclosure =
      /\b(?:being abused|was abused|was assaulted|being assaulted|was cut|going to be cut|being forced|was forced|threatened me|hit me|anapanga kumkata|anapanga kumkeketa|anampiga|amenipiga|ananipiga|amenitishia|ananitishia|kulazimishwa kuolewa|familia inanilazimisha)\b/i.test(
        question,
      ) ||
      (/\b(?:child|children|girl|sister|daughter|woman|mtoto|watoto|msichana|dada|binti|mwanamke)\b/i.test(
        question,
      ) &&
        /\b(?:is being|was|has been|will be|going to be|could be|plans? to|wants? to|forced|threaten\w*|hit|cut|marry|abuse|assault|harm|injure|anapanga|anataka|analazimishwa|atalazimishwa|anatishiwa|anapigwa|atakatwa|atakeketwa|kuolewa kwa lazima)\b/i.test(
          question,
        ));
    return personalContext || healthCase || caseDisclosure;
  }

  private minimizeProviderQuery(question: string): string {
    return question
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
      .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[number removed]")
      .replace(
        /\b(?:my name is|jina langu ni|ninaitwa)\s+[\p{L}'-]+(?:\s+[\p{L}'-]+){0,2}/giu,
        "[name removed]",
      )
      .replace(
        /\b(?:my|rafiki yangu|dada yangu|ndugu yangu|mtoto wangu|binti yangu)\s+([A-Z][\p{L}'-]+)\b/gu,
        (_match, _name: string) => "[person removed]",
      )
      .replace(/\b(?:my address is|anwani yangu ni)\s+[^,.!?]+/giu, "[address removed]")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .slice(0, 800);
  }

  private isSelfFocused(question: string): boolean {
    return /\b(?:i|me|my|mine|myself|nina|nime|nakwenda|kwangu|yangu|mimi)\b/i.test(
      question,
    );
  }

  private isUrgent(question: string): boolean {
    return /niko.{0,12}hatari|yuko.{0,12}hatari|anani(tishia|piga)|right now|immediate danger|being attacked|in danger now/i.test(
      question,
    );
  }
}
