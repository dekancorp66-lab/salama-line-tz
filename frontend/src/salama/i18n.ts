import type { CaseKind, Lang, ServiceKind } from "./types.ts";

/**
 * All user-facing strings, Swahili + English. PLAIN ASCII ONLY (no curly
 * quotes, no emoji) so SMS stays single-byte GSM-7 and USSD never garbles.
 * Swahili wording is a first draft: have native speakers and young people
 * review it before pilot (the proposal requires this).
 * Wording on anything that lands on her phone is deliberately neutral.
 */
export interface Strings {
  langMenu: string;
  main: string;
  infoMenu: string;
  infoAfter: (short: string) => string;
  districtMenu: (title: string, names: string[]) => string;
  svcKindMenu: string;
  svcList: (lines: string[]) => string;
  helpMenu: string;
  consent: (district: string) => string;
  helpDone: (code: string) => string;
  helpDeclined: string;
  reportMenu: string;
  reportConfirm: string;
  reportDone: string;
  wellbeingMenu: string;
  wellbeingLow: string;
  wellbeingNo: string;
  deleteConfirm: string;
  deleted: string;
  deleteNone: string;
  exit: string;
  invalid: string;
  contentPending: string;
  servicesPending: string;
  smsMenu: string;
  needDistrict: (cmd: string, districts: string[]) => string;
  consentSms: (district: string) => string;
  consentExpired: string;
  helpDoneSms: (code: string) => string;
  declinedSms: string;
  reportDoneSms: string;
  wellbeingPrompt: string;
  wellbeingLowSms: string;
  closedToGirl: (code: string) => string;
  noneToConfirm: string;
  kindMenuLabel: Record<ServiceKind, string>;
  smsFooter: string;
  sentSms: string;
}

const sw: Strings = {
  langMenu: "SalamaLine\n1. Kiswahili\n2. English",
  main: "SalamaLine\n1. Taarifa\n2. Huduma karibu\n3. Omba msaada\n4. Ripoti wasiwasi\n5. Hali yako\n0 Rudi 00 Toka 99 Futa",
  infoMenu: "Taarifa:\n1. Ndoa za utotoni\n2. Ukeketaji (FGM)\n3. Usalama mtandaoni\n4. Afya ya uzazi\n0 Rudi",
  infoAfter: (s) => `${s}\n1. Tuma kwa SMS\n0 Rudi`,
  districtMenu: (t, n) => `${t}\n${n.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n0 Rudi`,
  svcKindMenu: "Huduma:\n1. Kliniki\n2. Msaada wa sheria\n3. Ustawi wa jamii\n4. Ushauri nasaha\n5. Zote kwa SMS\n0 Rudi",
  svcList: (l) => `${l.join("\n")}\n1. Tuma kwa SMS\n0 Rudi`,
  helpMenu: "Omba msaada:\n1. Naogopa kuolewa\n2. Naogopa kukeketwa\n3. Ukatili au hatari nyingine\n4. Nilikeketwa, nahitaji huduma\n0 Rudi",
  consent: (d) => `Mtu aliyefunzwa wa ${d} atawasiliana nawe kwa namba hii. Tunaitunza hadi kesi ifungwe.\n1. Ndiyo, wasiliana nami\n2. Hapana, taarifa tu\n0 Rudi`,
  helpDone: (c) => `Ombi limepokelewa. Msimbo: ${c}. Utapata ujumbe hivi karibuni. Usipopata msaada piga 116 (bure).`,
  helpDeclined: "Sawa. Hakuna aliyearifiwa. Msaada wa bure: piga 116. Orodha ya huduma imetumwa kwa SMS.",
  reportMenu: "Ripoti wasiwasi (bila jina):\n1. Ndoa ya utotoni\n2. Ukeketaji\n3. Ukatili mwingine\n0 Rudi",
  reportConfirm: "Hatuhifadhi namba yako. Mtoa huduma wa simu anaweza kuona matumizi.\n1. Tuma ripoti\n0 Rudi",
  reportDone: "Ripoti imepokelewa. Mtu aliyefunzwa atafuatilia kwa utaratibu wa jamii. Asante.",
  wellbeingMenu: "Umejisikiaje siku hizi?\n1. Vizuri\n2. Kawaida\n3. Si vizuri\n4. Vibaya sana\n0 Rudi",
  wellbeingLow: "Pole. Msaada wa bure upo: piga 116.\nUngependa mshauri aliyefunzwa akutafute?\n1. Ndiyo\n2. Hapana\n0 Rudi",
  wellbeingNo: "Sawa. Wakati wowote piga 116 (bure). Jitunze.",
  deleteConfirm: "Futa data yako yote kwenye SalamaLine?\n1. Ndiyo, futa\n2. Hapana\n0 Rudi",
  deleted: "Imefutwa. Hatuna data yako.",
  deleteNone: "Hatuna data yako. Hakuna cha kufuta.",
  exit: "Asante.",
  invalid: "Chaguo si sahihi.\n",
  contentPending: "Taarifa hii bado inakaguliwa. Piga 116 (bure) kwa msaada.",
  servicesPending: "Orodha ya wilaya hii bado inakaguliwa. Piga 116 (bure).",
  smsMenu: "SalamaLine. Tuma: KLINIKI wilaya | MSAADA wilaya | FGM wilaya | RIPOTI wilaya | USHAURI wilaya | HABARI NDOA/FGM/MTANDAO/AFYA | USTAWI | FUTA. Msaada wa bure: 116.",
  needDistrict: (c, d) => `Tuma ${c} na wilaya. Wilaya: ${d.join(", ")}.`,
  consentSms: (d) => `Mtu aliyefunzwa wa ${d} atawasiliana nawe kwa namba hii. Tunaitunza hadi kesi ifungwe. Jibu NDIO kukubali au HAPANA. Msaada wa bure: 116.`,
  consentExpired: "Muda umeisha. Tuma ombi tena. Msaada wa bure: 116.",
  helpDoneSms: (c) => `Ombi lako limepokelewa. Msimbo ${c}. Utapata ujumbe hivi karibuni. Usipopata msaada piga 116 (bure).`,
  declinedSms: "Sawa. Hakuna aliyearifiwa. Msaada wa bure: piga 116.",
  reportDoneSms: "Ripoti imepokelewa. Asante.",
  wellbeingPrompt: "Umejisikiaje? Jibu USTAWI 1 (vizuri), USTAWI 2 (kawaida), USTAWI 3 (si vizuri), USTAWI 4 (vibaya sana).",
  wellbeingLowSms: "Pole. Msaada wa bure upo: piga 116. Kama unataka mshauri aliyefunzwa akutafute, tuma USHAURI na wilaya yako.",
  closedToGirl: (c) => `Kesi ${c} imefungwa na namba yako imefutwa. Msaada wa bure: 116.`,
  noneToConfirm: "Hakuna ombi linalosubiri. Tuma SALAMA kuona chaguo.",
  kindMenuLabel: { clinic: "Kliniki", legal: "Msaada wa sheria", welfare: "Ustawi wa jamii", counselling: "Ushauri nasaha" },
  smsFooter: "Msaada wa bure: 116",
  sentSms: "Imetumwa kwa SMS.",
};

const en: Strings = {
  langMenu: sw.langMenu,
  main: "SalamaLine\n1. Information\n2. Nearby services\n3. Ask for help\n4. Report a concern\n5. Wellbeing\n0 Back 00 Exit 99 Delete",
  infoMenu: "Information:\n1. Child marriage\n2. FGM\n3. Online safety\n4. Reproductive health\n0 Back",
  infoAfter: (s) => `${s}\n1. Send by SMS\n0 Back`,
  districtMenu: (t, n) => `${t}\n${n.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n0 Back`,
  svcKindMenu: "Services:\n1. Clinic\n2. Legal aid\n3. Social welfare\n4. Counselling\n5. All by SMS\n0 Back",
  svcList: (l) => `${l.join("\n")}\n1. Send by SMS\n0 Back`,
  helpMenu: "Ask for help:\n1. I fear a forced marriage\n2. I fear being cut (FGM)\n3. Violence or other danger\n4. I was cut, I need care\n0 Back",
  consent: (d) => `A trained person in ${d} will contact you on this number. We keep it only until the case is closed.\n1. Yes, contact me\n2. No, info only\n0 Back`,
  helpDone: (c) => `Request received. Code: ${c}. You will get a message soon. If you get no help, call 116 (free).`,
  helpDeclined: "OK. Nobody was alerted. Free help: call 116. A list of services was sent by SMS.",
  reportMenu: "Report a concern (no name):\n1. Child marriage\n2. FGM\n3. Other violence\n0 Back",
  reportConfirm: "We do not store your number. Your phone network may still see usage.\n1. Send report\n0 Back",
  reportDone: "Report received. A trained person will follow up using the community protocol. Thank you.",
  wellbeingMenu: "How have you been feeling lately?\n1. Good\n2. Okay\n3. Not good\n4. Very bad\n0 Back",
  wellbeingLow: "I am sorry. Free support exists: call 116.\nWould you like a trained counsellor to contact you?\n1. Yes\n2. No\n0 Back",
  wellbeingNo: "OK. You can call 116 (free) any time. Take care.",
  deleteConfirm: "Delete all your data on SalamaLine?\n1. Yes, delete\n2. No\n0 Back",
  deleted: "Deleted. We hold no data about you.",
  deleteNone: "We hold no data about you. Nothing to delete.",
  exit: "Thank you.",
  invalid: "Invalid choice.\n",
  contentPending: "This information is still being reviewed. Call 116 (free) for help.",
  servicesPending: "The list for this district is still being verified. Call 116 (free).",
  smsMenu: "SalamaLine. Send: CLINIC district | HELP district | FGM district | REPORT district | COUNSELLOR district | INFO MARRIAGE/FGM/ONLINE/HEALTH | WELLBEING | DELETE. Free help: 116.",
  needDistrict: (c, d) => `Send ${c} and your district. Districts: ${d.join(", ")}.`,
  consentSms: (d) => `A trained person in ${d} will contact you on this number. We keep it only until the case is closed. Reply YES to agree or NO. Free help: 116.`,
  consentExpired: "That request expired. Please send it again. Free help: 116.",
  helpDoneSms: (c) => `Your request was received. Code ${c}. You will get a message soon. If you get no help, call 116 (free).`,
  declinedSms: "OK. Nobody was alerted. Free help: call 116.",
  reportDoneSms: "Report received. Thank you.",
  wellbeingPrompt: "How are you feeling? Reply WELLBEING 1 (good), WELLBEING 2 (okay), WELLBEING 3 (not good), WELLBEING 4 (very bad).",
  wellbeingLowSms: "I am sorry. Free support exists: call 116. If you want a trained counsellor to contact you, send COUNSELLOR and your district.",
  closedToGirl: (c) => `Case ${c} is closed and your number was deleted. Free help: 116.`,
  noneToConfirm: "Nothing is waiting. Send MENU to see options.",
  kindMenuLabel: { clinic: "Clinic", legal: "Legal aid", welfare: "Social welfare", counselling: "Counselling" },
  smsFooter: "Free help: 116",
  sentSms: "Sent by SMS.",
};

export const STR: Record<Lang, Strings> = { sw, en };

/** Responder-facing text. Staff-only, so one compact bilingual form. */
export const KIND_LABEL: Record<CaseKind, string> = {
  marriage: "forced marriage / ndoa",
  fgm: "FGM / ukeketaji",
  violence: "violence / ukatili",
  counsellor: "counselling / ushauri",
  general: "help request / ombi la msaada",
};
