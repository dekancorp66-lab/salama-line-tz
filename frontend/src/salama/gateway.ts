import { maskPhone } from "./privacy.ts";
import type { Outbound } from "./types.ts";
import { splitMessage } from "./whatsapp.ts";

export interface Gateway { send(to: string, text: string): Promise<void> }

/** Collects messages instead of sending them: tests and the demo simulator. */
export class CaptureGateway implements Gateway {
  sent: { to: string; text: string }[] = [];
  async send(to: string, text: string) { this.sent.push({ to, text }); }
}

/** Dev fallback: logs a masked recipient and the length only, never the text. */
export class ConsoleGateway implements Gateway {
  async send(to: string, text: string) {
    console.log(`[sms] to=${maskPhone(to)} chars=${text.length}`);
  }
}

/** Africa's Talking bulk SMS. Set AT_USERNAME=sandbox to use their sandbox. */
export class AfricasTalkingGateway implements Gateway {
  private o: { apiKey: string; username: string; from?: string };
  constructor(o: { apiKey: string; username: string; from?: string }) { this.o = o; }
  async send(to: string, text: string) {
    const host = this.o.username === "sandbox" ? "api.sandbox.africastalking.com" : "api.africastalking.com";
    const body = new URLSearchParams({ username: this.o.username, to, message: text });
    if (this.o.from) body.set("from", this.o.from);
    const r = await fetch(`https://${host}/version1/messaging`, {
      method: "POST",
      headers: { apiKey: this.o.apiKey, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!r.ok) throw new Error(`AT ${r.status}`);
  }
}

/** WhatsApp Cloud API (Meta). Set WA_API_VERSION to move to a newer Graph API version. */
export class WhatsAppGateway implements Gateway {
  private o: { token: string; phoneId: string; version?: string };
  constructor(o: { token: string; phoneId: string; version?: string }) { this.o = o; }
  private url() { return `https://graph.facebook.com/${this.o.version ?? "v22.0"}/${this.o.phoneId}/messages`; }
  private async post(body: unknown, what: string) {
    const r = await fetch(this.url(), {
      method: "POST",
      headers: { Authorization: `Bearer ${this.o.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) {
      // Log Meta's error code only (e.g. 131047 = 24h window closed, 190 = bad token). Never the number or text.
      const code = await r.json().then((j: any) => j?.error?.code, () => undefined);
      throw new Error(`WA ${what} ${r.status}${code ? ` code ${code}` : ""}`);
    }
  }
  async send(to: string, text: string) {
    for (const part of splitMessage(text)) {
      await this.post({ messaging_product: "whatsapp", to: to.replace(/^\+/, ""), type: "text", text: { body: part } }, "send");
    }
  }
  /** Shows the blue ticks. Best effort: failure here must never matter. */
  async markRead(messageId: string) {
    await this.post({ messaging_product: "whatsapp", status: "read", message_id: messageId }, "read").catch(() => {});
  }
}

export interface Gateways { sms: Gateway; whatsapp?: Gateway }

/** Send everything; one failed message must never break the user's response. */
export async function deliver(out: Outbound[], gw: Gateways): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  await Promise.all(out.map(async (m) => {
    const g = m.via === "whatsapp" && gw.whatsapp ? gw.whatsapp : gw.sms;
    try { await g.send(m.to, m.text); sent += 1; }
    catch (e) { failed += 1; console.error("[gateway] send failed:", (e as Error).message); } // no number, no text
  }));
  return { sent, failed };
}
