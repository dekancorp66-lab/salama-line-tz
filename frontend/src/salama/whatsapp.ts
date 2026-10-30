/**
 * Pure helpers for the WhatsApp Cloud API: reading Meta's webhook payload and
 * splitting long replies. No network and no secrets here, so it is easy to test.
 */

export interface WaInbound {
  /** Meta's message id (wamid...). Used only to ignore Meta's retries. */
  id: string;
  /** Sender as +E.164. */
  from: string;
  /** Text to feed to the command router. Empty when the message type is unsupported. */
  text: string;
  /** True for images, voice notes, video, documents, stickers, locations, contacts. */
  unsupported: boolean;
}

const UNSUPPORTED = new Set(["image", "audio", "voice", "video", "document", "sticker", "location", "contacts"]);

/**
 * Pull the user messages out of a webhook body. Delivery/read receipts, reactions
 * and system events are ignored. The sender's profile name is deliberately never
 * read: SalamaLine stores no names.
 */
export function parseWhatsApp(body: unknown): WaInbound[] {
  const out: WaInbound[] = [];
  const b = body as any;
  for (const entry of Array.isArray(b?.entry) ? b.entry : []) {
    for (const ch of Array.isArray(entry?.changes) ? entry.changes : []) {
      for (const m of Array.isArray(ch?.value?.messages) ? ch.value.messages : []) {
        if (!m?.from || !m?.id) continue;
        const from = `+${String(m.from).replace(/\D/g, "")}`;
        const id = String(m.id);
        let text = "";
        if (m.type === "text") text = String(m.text?.body ?? "");
        else if (m.type === "interactive") {
          const r = m.interactive?.button_reply ?? m.interactive?.list_reply;
          text = String(r?.id ?? r?.title ?? ""); // button/list ids carry the command word
        } else if (m.type === "button") text = String(m.button?.payload ?? m.button?.text ?? "");
        else if (UNSUPPORTED.has(m.type)) {
          out.push({ id, from, text: "", unsupported: true });
          continue;
        } else continue; // reaction, system, request_welcome, unknown
        if (text.trim()) out.push({ id, from, text, unsupported: false });
      }
    }
  }
  return out;
}

/** WhatsApp rejects bodies over 4096 characters; split on a newline or space where possible. */
export function splitMessage(text: string, max = 3800): string[] {
  const parts: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(" ", max);
    if (cut < max * 0.5) cut = max;
    parts.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) parts.push(rest);
  return parts.length ? parts : [""];
}
