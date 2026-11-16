import { Injectable } from "@nestjs/common";
import { RetrievedKnowledge } from "./knowledge/knowledge-retrieval.service";

export type ScopeDecision =
  "relevant" | "greeting" | "thanks" | "clarify" | "out_of_scope";

@Injectable()
export class AiScopePolicyService {
  private readonly greetings =
    /^(hi|hello|hey|habari|hujambo|mambo|good morning|good afternoon|good evening)(?:[,!?.\s]+(?:how are you|how's it going|what's up|ukoje))?[!.?,\s]*$/i;
  private readonly thanks =
    /^(thanks|thank you|thank you so much|asante|asante sana|shukrani)(?:[,!?.\s]+(?:that helps|that helped|that's helpful|that was helpful|for your help|nimeelewa|sana))?[!.?,\s]*$/i;

  // Explicit task intent matters: a domain word inside an unrelated coding,
  // entertainment, or homework request does not make that task in scope.
  private readonly unrelatedTaskPatterns = [
    /\b(?:write|create|build|debug|fix|run|compile|teach me|tutorial|show me how to)\b.{0,80}\b(?:code|coding|program|programming|script|software|website|web app|html|css|javascript|typescript|python|java|sql|algorithm)\b/i,
    /\b(?:nisaidie|nifundishe|andika|tengeneza|rekebisha|programu|nifanyie)\b.{0,80}\b(?:code|coding|programu|script|website|mchezo wa simu|javascript|python|java|sql|html|css)\b/i,
    /\b(?:coding|programming|debugging|software development|computer science tutorial)\b/i,
    /\b(?:do|solve|answer|complete|check)\s+(?:my\s+)?(?:homework|assignment|exam|worksheet)\b/i,
    /\b(?:nifanyie|nisaidie kufanya|jibu)\b.{0,40}\b(?:homework|assignment|kazi ya shule|kemia|fizikia|hisabati|algebra)\b/i,
    /\b(?:solve|calculate|factor|differentiate|integrate)\b.{0,60}\b(?:equation|integral|derivative|algebra|calculus|geometry|physics|chemistry)\b/i,
    /\b(?:teach|help|explain|solve)\b.{0,50}\b(?:algebra|calculus|geometry|physics|chemistry|biology|trigonometry|equations?)\b/i,
    /\b(?:tell me a joke|write a song|recommend a movie|movie review|game strategy|video game|celebrity gossip|sports trivia)\b/i,
  ];

  private readonly adversarialPatterns = [
    /\b(ignore|disregard|forget)\b.{0,50}\b(previous|prior|all|your)\b.{0,30}\b(instructions|rules|policy|prompt)\b/i,
    /\b(reveal|print|show|repeat|disclose|give me)\b.{0,50}\b(system prompt|hidden instructions|developer message|api key|secret)\b/i,
    /\b(puuza|sahau)\b.{0,40}\b(sheria|maelekezo|ulinzi)\b.{0,40}\b(api key|ufunguo|maelekezo yaliyofichwa|prompt)\b/i,
    /\b(nipe|onyesha|toa|unipe)\b.{0,40}\b(api key|ufunguo wa api|maelekezo yaliyofichwa|prompt ya mfumo)\b/i,
    /\b(jailbreak|bypass (?:your|the) (?:safety|scope|rules)|act as an? unrestricted|pretend you have no rules)\b/i,
  ];

  private readonly domainPatterns = [
    // Child rights, protection, and safeguarding
    /\b(child|children|kid|kids|minors?|mtoto|watoto|msichana|mvulana|guardian|mzazi|mlezi|parent|schoolgirl|schoolboy)\b/i,
    /\b(sister|daughter|relative|family)\b.{0,55}\b(cut|force|marry|hurt|threaten|abuse|harm)\b/i,
    /\b(family|parent|relative|mlezi|mzazi|familia)\b.{0,55}\b(pressur\w*|force|shinikiz\w*|lazimish\w*)\b.{0,40}\b(marry|marriage|kuolewa|ndoa)\b/i,
    /\b(child[- ]marriage|marriage before 18|marry before 18|ndoa ya utotoni|ukeketaji|female genital mutilation|\bfgm\b|corporal punishment|child abuse|child protection|haki za mtoto)\b/i,
    /\b(violence|abuse|neglect|exploitation|safeguarding|protection|hatari|usalama|ukatili|unyanyasaji|unyonyaji|kulindwa|domestic violence|intimate partner|coercion|trafficking|forced marriage|cannot leave|won't let me leave|threatening me|feel unsafe|sharing my name|privacy|faragha)\b/i,
    // Women’s rights and equality
    /\b(woman|women|girl|girls|mwanamke|wanawake|haki za wanawake|gender equality|discrimination|ubaguzi|equality|usawa)\b/i,
    // Health education and healthcare navigation
    /\b(health|healthcare|medical|clinic|hospital|doctor|nurse|pregnan\w*|menstruat\w*|periods?|reproductive|sexual health|mental health|depression|anxiety|afya|mgonjwa|daktari|hospitali|kliniki|ujauzito|hedhi|uzazi|dalili|dawa|medicine|medication|symptoms?|bleeding|pain|contracept\w*)\b/i,
    // Education access and school rights, not general subject tutoring
    /\b(education|school|schooling|enrol\w*|tuition|teacher|student|learner|elimu|shule|mwanafunzi|masomo|ada ya shule)\b/i,
    // Tanzanian law, policy, constitutional rights, and verified support services
    /\b(Constitution|Katiba|law|laws|legal|sheria|policy|policies|sera|court|mahakama|social welfare|ustawi wa jamii|support service|helpline|referral|msaada|huduma za ulinzi)\b/i,
    /\b(Tanzania|Tanzanian|Mainland|Zanzibar)\b.{0,60}\b(Constitution|law|legal|rights|policy|court|sheria|haki|sera|mahakama)\b/i,
    // Immediate safety disclosures are always routed to local safeguarding.
    /\b(in danger|immediate danger|threatened|being hurt|niko hatarini|yuko hatarini|anani\w*|wanani\w*)\b/i,
  ];

  classify(question: string, retrieved: RetrievedKnowledge[]): ScopeDecision {
    const text = question.trim();
    if (this.adversarialPatterns.some((pattern) => pattern.test(text)))
      return "out_of_scope";
    if (this.unrelatedTaskPatterns.some((pattern) => pattern.test(text)))
      return "out_of_scope";
    if (this.greetings.test(text)) return "greeting";
    if (this.thanks.test(text)) return "thanks";

    if (
      /^(and|also|but|then|what about (it|that|her|him|them|this)|how about (it|that|her|him|them|this)|does that|would that|na je|vipi kuhusu (hilo|huyo|hiyo)|na pia|na akisema|akikataa|akikubali)\b/i.test(
        text,
      ) ||
      /^(why is that|why does that|why so|kwa nini hivyo|kwa nini hivyo basi)\??$/i.test(
        text,
      ) ||
      /^(can you explain (more|that|it)|what should (i|she|he|they|we) do( next)?|how can i help\??|can|could|should|would)\s+(she|he|they|i|we)\b|^what if (she|he|they|i|we)\b/i.test(
        text,
      )
    )
      return "clarify";

    const hasDomainSignal = this.domainPatterns.some((pattern) =>
      pattern.test(text),
    );
    // Retrieval relevance supplies a second, context-sensitive signal for
    // paraphrases that do not repeat the knowledge base's surface vocabulary.
    const hasRelevantEvidence = retrieved.some(
      (item) =>
        item.score >= 0.35 &&
        (item.record.verified === true || item.score >= 0.45),
    );
    if (hasDomainSignal || hasRelevantEvidence) return "relevant";

    // The API has no conversation-history field. Preserve conversational turns
    // by asking for the missing subject instead of rejecting them as unrelated.
    return "out_of_scope";
  }
}
