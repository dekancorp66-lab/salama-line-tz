import type { ContentItem } from "../types.ts";

/**
 * APPROVED CONTENT BANK.
 * Everything below is a PLACEHOLDER until a named professional reviews it and
 * a native Swahili speaker checks the wording. In live mode (SALAMA_LIVE=1) the
 * engine refuses to serve anything whose status is not "approved", so a girl
 * can never receive unreviewed text. To approve an item: set reviewer,
 * reviewedAt, source, and status: "approved" (this is a reviewed code change).
 * Text is plain ASCII on purpose: it keeps every SMS in cheap single-byte GSM-7.
 */
const P = (
  id: string,
  topic: ContentItem["topic"],
  lang: ContentItem["lang"],
  short: string,
  full: string,
): ContentItem => ({
  id,
  topic,
  lang,
  short,
  full,
  source: "PLACEHOLDER - pending professional review",
  reviewer: null,
  reviewedAt: null,
  status: "placeholder",
});

export const CONTENT: ContentItem[] = [
  P("marriage-sw", "marriage", "sw",
    "Ndoa ya utotoni inaweza kuathiri afya na masomo yako. Una haki ya kuwa salama na kuomba msaada.",
    "Ndoa ya utotoni inaweza kuathiri afya, masomo na ndoto zako. Una haki ya kuwa salama. Hujakosea kuomba msaada. Unaweza kuomba mtu aliyefunzwa akusaidie, au kupata huduma karibu nawe. Msaada wa bure: piga 116."),
  P("marriage-en", "marriage", "en",
    "Child marriage can harm your health and schooling. You have the right to be safe and to ask for help.",
    "Child marriage can harm your health, schooling and dreams. You have the right to be safe. Asking for help is not wrong. You can ask a trained person to help you or find services near you. Free help: call 116."),
  P("fgm-sw", "fgm", "sw",
    "Ukeketaji una madhara kwa afya. Si lazima, na kuna msaada kama unaogopa au ulikeketwa.",
    "Ukeketaji (FGM) una madhara kwa afya ya mwili na akili. Si wajibu wa dini wala mila yoyote kwa msichana. Kama unaogopa kukeketwa, au ulishakeketwa na unahitaji huduma, tuko hapa kukusaidia. Msaada wa bure: piga 116."),
  P("fgm-en", "fgm", "en",
    "FGM harms health. It is not required, and help exists if you are afraid or were already cut.",
    "FGM harms physical and mental health. It is not something a girl must go through. If you are afraid of being cut, or were cut and need care, help is available and you will not be judged. Free help: call 116."),
  P("online-sw", "online", "sw",
    "Picha au ujumbe wa kukutishia mtandaoni si kosa lako. Usilipe, hifadhi ushahidi, omba msaada.",
    "Ukitishiwa mtandaoni au picha zako zikitumiwa vibaya, si kosa lako. Usilipe pesa wala usitume picha zaidi. Hifadhi ujumbe kama ushahidi, zuia mtu huyo, na umwambie mtu unayemwamini au omba msaada hapa. Msaada wa bure: piga 116."),
  P("online-en", "online", "en",
    "Threats or image abuse online are never your fault. Do not pay, keep proof, and ask for help.",
    "If someone threatens you online or misuses your pictures, it is not your fault. Do not pay money or send more pictures. Keep the messages as proof, block the person, and tell someone you trust or ask for help here. Free help: call 116."),
  P("health-sw", "health", "sw",
    "Una haki ya kupata taarifa na huduma za afya kwa heshima. Kliniki rafiki kwa vijana zipo.",
    "Una haki ya kupata taarifa sahihi na huduma za afya ya uzazi kwa heshima na siri. Kliniki rafiki kwa vijana zinaweza kukusaidia. Tuma KLINIKI na jina la wilaya yako kupata kliniki iliyo karibu."),
  P("health-en", "health", "en",
    "You have the right to respectful, private health information and care. Youth-friendly clinics exist.",
    "You have the right to accurate, respectful and private reproductive health information and care. Youth-friendly clinics can help. Send CLINIC and your district name to find the nearest one."),
];

export const WELLBEING_TIPS: Record<"sw" | "en", string> = {
  sw: "Ni vizuri kusikia hivyo. Endelea kuongea na mtu unayemwamini, lala vya kutosha, na ukihitaji msaada tuma USTAWI wakati wowote.",
  en: "Good to hear. Keep talking with someone you trust, get enough rest, and send WELLBEING any time you need support.",
};
