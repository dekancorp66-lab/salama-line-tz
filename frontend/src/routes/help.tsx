import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Heart,
  LocateFixed,
  Lock,
  MapPin,
  Search,
  Send,
  Shield,
  Users,
} from "lucide-react";
import { CopyButton } from "@/components/copy-button.tsx";
import { PublicHeader } from "@/components/public-header.tsx";
import { en } from "@/i18n/en.ts";
import { useI18n, usePageMeta } from "@/i18n/provider.tsx";
import type { TranslationKey } from "@/i18n/types.ts";
import { submitHelpRequest, type HelpRequestReceipt } from "@/lib/backend-api";
import {
  TANZANIA_MAINLAND_REGIONS,
  findRegionById,
  type TanzaniaDistrict,
  type TanzaniaRegion,
} from "@/salama/data/tanzania-mainland-locations";

export const Route = createFileRoute("/help")({
  component: () => <Navigate to="/report" replace />,
});

type FormError =
  | { kind: "key"; key: TranslationKey }
  | { kind: "api"; cause: unknown };

type Step = "location" | "details";
type LocationMethod = "manual" | "gps";
type GpsStatus =
  | "idle"
  | "detecting"
  | "detected"
  | "needs_review"
  | "denied"
  | "unavailable"
  | "failed";

const topics = ["CHILD_MARRIAGE", "FGM", "DIGITAL_SAFETY", "WELLBEING", "OTHER"] as const;

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pickRegionFromAddress(address: Record<string, string | undefined>): TanzaniaRegion | undefined {
  const candidates = [address.state, address.region, address.county, address.state_district]
    .filter((v): v is string => Boolean(v))
    .map(normalizeName);
  for (const candidate of candidates) {
    const region = TANZANIA_MAINLAND_REGIONS.find((r) => {
      const n = normalizeName(r.name);
      return n === candidate || candidate.includes(n) || n.includes(candidate);
    });
    if (region) return region;
  }
  return undefined;
}

function pickDistrictFromAddress(
  region: TanzaniaRegion,
  address: Record<string, string | undefined>,
): TanzaniaDistrict | undefined {
  const candidates = [
    address.city_district,
    address.district,
    address.municipality,
    address.town,
    address.city,
    address.county,
    address.suburb,
  ]
    .filter((v): v is string => Boolean(v))
    .map(normalizeName);
  for (const candidate of candidates) {
    const matches = region.districts.filter((d) => {
      const n = normalizeName(d.name);
      return n === candidate || candidate.includes(n) || n.includes(candidate);
    });
    if (matches.length === 1) return matches[0];
  }
  return undefined;
}

function SearchableOptionList(props: {
  id: string;
  label: string;
  searchLabel: string;
  searchPlaceholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  options: { id: string; name: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const {
    id,
    label,
    searchLabel,
    searchPlaceholder,
    query,
    onQueryChange,
    options,
    selectedId,
    onSelect,
    disabled,
    disabledHint,
  } = props;
  return (
    <div className="space-y-2">
      <label htmlFor={`${id}-search`} className="block text-sm font-semibold">
        {label}
      </label>
      <input
        id={`${id}-search`}
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        disabled={disabled}
        placeholder={searchPlaceholder}
        aria-label={searchLabel}
        className="min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink disabled:cursor-not-allowed disabled:opacity-50"
      />
      {disabled ? (
        <p className="rounded-xl border border-line bg-soft px-3 py-3 text-sm text-muted">{disabledHint}</p>
      ) : (
        <div
          role="listbox"
          aria-label={label}
          className="max-h-56 overflow-y-auto rounded-xl border border-line bg-paper p-1"
        >
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">—</p>
          ) : (
            options.map((option) => {
              const selected = option.id === selectedId;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onSelect(option.id)}
                  className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                    selected
                      ? "bg-pink-soft font-semibold text-pink"
                      : "text-ink hover:bg-soft"
                  }`}
                >
                  <span>{option.name}</span>
                  {selected ? <Check size={16} className="shrink-0" /> : null}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function GetHelpForm({ current = "/report" }: { current?: string }) {
  const { t, errorMessage } = useI18n();
  usePageMeta("help");
  const [step, setStep] = useState<Step>("location");
  const [locationMethod, setLocationMethod] = useState<LocationMethod>("manual");
  const [regionId, setRegionId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [regionQuery, setRegionQuery] = useState("");
  const [districtQuery, setDistrictQuery] = useState("");
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [gpsMessageKey, setGpsMessageKey] = useState<TranslationKey | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [includeCoords, setIncludeCoords] = useState(false);

  const [topic, setTopic] = useState<string>("");
  const [concern, setConcern] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [consent, setConsent] = useState(false);
  const [contact, setContact] = useState("");
  const [priority, setPriority] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [receipt, setReceipt] = useState<HelpRequestReceipt | null>(null);

  const selectedRegion = useMemo(() => findRegionById(regionId), [regionId]);
  const selectedDistrict = useMemo(
    () => selectedRegion?.districts.find((d) => d.id === districtId),
    [selectedRegion, districtId],
  );

  const filteredRegions = useMemo(() => {
    const q = normalizeName(regionQuery);
    if (!q) return TANZANIA_MAINLAND_REGIONS;
    return TANZANIA_MAINLAND_REGIONS.filter((r) => normalizeName(r.name).includes(q));
  }, [regionQuery]);

  const filteredDistricts = useMemo(() => {
    const districts = selectedRegion?.districts ?? [];
    const q = normalizeName(districtQuery);
    if (!q) return districts;
    return districts.filter((d) => normalizeName(d.name).includes(q));
  }, [selectedRegion, districtQuery]);

  function selectRegion(id: string) {
    setRegionId(id);
    setDistrictId("");
    setDistrictQuery("");
    setError(null);
  }

  function selectDistrict(id: string) {
    setDistrictId(id);
    setError(null);
  }

  function resetForm() {
    setStep("location");
    setLocationMethod("manual");
    setRegionId("");
    setDistrictId("");
    setRegionQuery("");
    setDistrictQuery("");
    setGpsStatus("idle");
    setGpsMessageKey(null);
    setCoords(null);
    setIncludeCoords(false);
    setTopic("");
    setConcern("");
    setAnonymous(false);
    setConsent(false);
    setContact("");
    setPriority("NORMAL");
  }

  async function detectLocation() {
    if (!("geolocation" in navigator)) {
      setGpsStatus("unavailable");
      setGpsMessageKey("help.locationUnavailable");
      return;
    }
    setGpsStatus("detecting");
    setGpsMessageKey(null);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setCoords({ latitude, longitude });
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}&zoom=10&addressdetails=1`;
          const response = await fetch(url, { headers: { Accept: "application/json" } });
          if (!response.ok) throw new Error("reverse geocoding failed");
          const data = (await response.json()) as { address?: Record<string, string | undefined> };
          const address = data.address ?? {};
          const region = pickRegionFromAddress(address);
          const district = region ? pickDistrictFromAddress(region, address) : undefined;
          if (region) {
            setRegionId(region.id);
            setRegionQuery("");
            setDistrictId(district?.id ?? "");
            setDistrictQuery("");
          }
          if (region && district) {
            setGpsStatus("detected");
            setGpsMessageKey("help.locationDetected");
          } else {
            setGpsStatus("needs_review");
            setGpsMessageKey("help.locationNeedsReview");
          }
        } catch {
          setGpsStatus("needs_review");
          setGpsMessageKey("help.locationNeedsReview");
        }
      },
      (geoError) => {
        setCoords(null);
        setIncludeCoords(false);
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setGpsStatus("denied");
          setGpsMessageKey("help.locationPermissionDenied");
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          setGpsStatus("unavailable");
          setGpsMessageKey("help.locationUnavailable");
        } else {
          setGpsStatus("failed");
          setGpsMessageKey("help.locationFailed");
        }
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  }

  function goToDetails(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!selectedRegion) return setError({ kind: "key", key: "help.errorRegion" });
    if (!selectedDistrict) return setError({ kind: "key", key: "help.errorDistrict" });
    setStep("details");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!selectedRegion || !selectedDistrict) {
      setStep("location");
      return setError({ kind: "key", key: "help.errorLocation" });
    }
    if (!topic) return setError({ kind: "key", key: "help.errorTopic" });
    if (anonymous && contact.trim()) return setError({ kind: "key", key: "help.errorBoth" });
    if (consent && !anonymous && !contact.trim()) return setError({ kind: "key", key: "help.errorContact" });

    setBusy(true);
    try {
      const result = await submitHelpRequest({
        topic,
        districtCode: selectedDistrict.id.toUpperCase(),
        regionId: selectedRegion.id,
        regionName: selectedRegion.name,
        districtId: selectedDistrict.id,
        districtName: selectedDistrict.name,
        channel: "WEB",
        concernSummary: concern.trim() || undefined,
        anonymousReport: anonymous,
        consentToContact: consent && !anonymous,
        contact: consent && !anonymous ? contact.trim() : undefined,
        priority,
        locationConsentGiven: Boolean(includeCoords && coords),
        latitude: includeCoords && coords ? coords.latitude : undefined,
        longitude: includeCoords && coords ? coords.longitude : undefined,
      });
      setReceipt(result);
      resetForm();
    } catch (cause) {
      setError({ kind: "api", cause });
    } finally {
      setBusy(false);
    }
  }

  const privacyLines = [t("help.privacy1"), t("help.privacy2"), t("help.privacy3"), t("help.privacy4")];
  const selectedLocationLabel =
    selectedRegion && selectedDistrict ? `${selectedRegion.name} · ${selectedDistrict.name}` : null;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <PublicHeader current={current} />

      <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-10 pt-32 sm:px-6 md:grid-cols-[320px_minmax(0,1fr)] md:pt-40">
        <aside className="space-y-4">
          <div className="rounded-[var(--radius-panel)] border border-line bg-paper p-5 shadow-sm md:p-6">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-pink-soft text-pink"><Heart size={21} /></span>
            <h1 className="mt-4 text-2xl font-semibold leading-tight md:text-3xl">{t("help.title")}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t("help.intro")}</p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line bg-paper p-5 text-sm">
            <p className="mb-3 flex items-center gap-2 font-semibold text-ink"><Shield size={17} className="text-pink" />{t("help.privacyTitle")}</p>
            <ul className="space-y-2.5 text-muted">
              {privacyLines.map((line) => (
                <li key={line} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-pink" /><span>{line}</span></li>
              ))}
            </ul>
          </div>
          <div role="note" className="rounded-[var(--radius-card)] border border-pink-line bg-pink-soft p-5 text-sm leading-relaxed">
            <p className="mb-2 flex items-center gap-2 font-semibold text-pink"><CircleAlert size={17} />{t("help.safetyTitle")}</p>
            <p className="text-ink">{t("help.safety")}</p>
          </div>
          <a href="/ai" className="flex items-center justify-between rounded-[var(--radius-card)] border border-line bg-paper px-5 py-4 text-sm font-medium text-ink transition hover:border-pink-line hover:bg-pink-soft">
            <span>{t("help.trustedInformation")}</span><span className="text-pink">→</span>
          </a>
          <a href="/track" className="flex items-center gap-3 rounded-[var(--radius-card)] border border-pink-line bg-pink-soft px-5 py-4 text-sm transition hover:bg-brand-fill hover:text-white">
            <Search size={18} className="shrink-0 text-pink" />
            <span>
              <span className="block font-semibold text-pink">{t("help.track")}</span>
              <span className="mt-0.5 block text-xs text-ink">{t("help.trackHint")}</span>
            </span>
          </a>
        </aside>

        <section aria-label={t("help.form")} className="min-w-0 rounded-[var(--radius-panel)] border border-line bg-paper p-5 shadow-[var(--shadow-soft)] sm:p-7 md:p-9">
          {receipt ? (
            <div className="mx-auto max-w-lg py-4 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-pink-soft text-pink"><Check size={27} /></span>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">{t("help.received")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{t("help.trainedReviews")}</p>
              <div className="mt-7 rounded-[var(--radius-card)] border border-pink-line bg-pink-soft p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-pink">{t("help.code")}</p>
                <p className="mt-2 break-all font-mono text-3xl font-semibold tracking-wider text-ink">{receipt.caseCode}</p>
                <div className="mt-4 flex justify-center">
                  <CopyButton value={receipt.caseCode} label={t("help.copyCode")} />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted">{t("help.codeHint")}</p>
              </div>
              <p className="mt-5 flex items-start justify-center gap-2 text-sm text-muted"><Lock size={16} className="mt-0.5 shrink-0 text-pink" />{t("help.saved")}</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <a href={`/track?code=${encodeURIComponent(receipt.caseCode)}`} className="brand-fill inline-flex min-h-11 items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white">
                  <Search size={16} />{t("help.trackThis")}
                </a>
                <button type="button" onClick={() => { setReceipt(null); }} className="inline-flex min-h-11 items-center rounded-full border border-line px-6 py-2.5 text-sm font-semibold text-ink transition hover:border-pink-line hover:bg-pink-soft">{t("help.another")}</button>
                <a href="/" className="inline-flex min-h-11 items-center rounded-full border border-line px-6 py-2.5 text-sm font-semibold text-ink transition hover:border-pink-line hover:bg-pink-soft">{t("common.backHome")}</a>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight">{t("help.form")}</h2>
                <p className="rounded-full bg-soft px-3 py-1 text-xs font-semibold text-muted">
                  {t("help.stepOf", { current: step === "location" ? 1 : 2, total: 2 })}
                </p>
              </div>

              {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-pink-line bg-pink-soft px-3 py-2.5 text-sm leading-relaxed text-pink-hover"><CircleAlert size={16} className="mt-0.5 shrink-0" />{error.kind === "key" ? t(error.key) : errorMessage(error.cause)}</p>}

              {step === "location" ? (
                <form onSubmit={goToDetails} className="space-y-6" noValidate>
                  <div className="rounded-[var(--radius-card)] border border-line bg-soft p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold"><MapPin size={17} className="text-pink" />{t("help.locationMethodTitle")}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{t("help.locationMethodHint")}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {([
                        ["manual", "help.methodManual", "help.methodManualHint"],
                        ["gps", "help.methodGps", "help.methodGpsHint"],
                      ] as const).map(([value, labelKey, hintKey]) => (
                        <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${locationMethod === value ? "border-pink bg-paper" : "border-line bg-paper/70 hover:border-pink-line"}`}>
                          <input
                            type="radio"
                            name="location-method"
                            value={value}
                            checked={locationMethod === value}
                            onChange={() => setLocationMethod(value)}
                            className="mt-1 accent-[var(--brand-pink)]"
                          />
                          <span>
                            <span className="block font-semibold">{t(labelKey)}</span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-muted">{t(hintKey)}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {locationMethod === "gps" && (
                    <div className="space-y-3 rounded-[var(--radius-card)] border border-line p-4">
                      <button
                        type="button"
                        onClick={() => void detectLocation()}
                        disabled={gpsStatus === "detecting"}
                        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-pink-line bg-pink-soft px-5 py-2.5 text-sm font-semibold text-pink transition hover:bg-brand-fill hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <LocateFixed size={16} />
                        {gpsStatus === "detecting" ? t("help.detectingLocation") : t("help.useMyLocation")}
                      </button>
                      {gpsMessageKey && (
                        <p className={`rounded-xl px-3 py-2.5 text-sm leading-relaxed ${gpsStatus === "detected" ? "bg-soft text-ink" : "bg-pink-soft text-pink-hover"}`}>
                          {t(gpsMessageKey)}
                        </p>
                      )}
                      {coords && (
                        <div className="space-y-2 text-sm">
                          <p className="text-muted">{t("help.coordsDetected", { lat: coords.latitude.toFixed(5), lng: coords.longitude.toFixed(5) })}</p>
                          <label className="flex items-start gap-3">
                            <input type="checkbox" checked={includeCoords} onChange={(e) => setIncludeCoords(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--brand-pink)]" />
                            <span>
                              <span className="font-semibold">{t("help.includeCoords")}</span>
                              <span className="mt-0.5 block text-xs leading-relaxed text-muted">{t("help.includeCoordsHint")}</span>
                            </span>
                          </label>
                        </div>
                      )}
                      {!coords && (gpsStatus === "denied" || gpsStatus === "unavailable" || gpsStatus === "failed") && (
                        <p className="text-xs text-muted">{t("help.includeCoordsUnavailable")}</p>
                      )}
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <SearchableOptionList
                      id="region"
                      label={t("help.region")}
                      searchLabel={t("help.regionSearch")}
                      searchPlaceholder={t("help.regionPlaceholder")}
                      query={regionQuery}
                      onQueryChange={setRegionQuery}
                      options={filteredRegions}
                      selectedId={regionId}
                      onSelect={selectRegion}
                    />
                    <SearchableOptionList
                      id="district"
                      label={t("help.district")}
                      searchLabel={t("help.districtSearch")}
                      searchPlaceholder={t("help.districtPlaceholder")}
                      query={districtQuery}
                      onQueryChange={setDistrictQuery}
                      options={filteredDistricts}
                      selectedId={districtId}
                      onSelect={selectDistrict}
                      disabled={!selectedRegion}
                      disabledHint={t("help.districtDisabled")}
                    />
                  </div>
                  <p className="text-xs leading-relaxed text-muted">{t("help.districtHint")}</p>

                  {selectedLocationLabel && (
                    <p className="rounded-xl border border-pink-line bg-pink-soft px-3 py-2.5 text-sm">
                      <span className="font-semibold text-pink">{t("help.locationSelected")}:</span>{" "}
                      <span className="text-ink">{selectedLocationLabel}</span>
                    </p>
                  )}

                  <button type="submit" className="brand-fill inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white">
                    {t("help.continue")} <ChevronRight size={17} />
                  </button>
                </form>
              ) : (
                <form onSubmit={(event) => void submit(event)} className="space-y-6" noValidate>
                  <div className="rounded-[var(--radius-card)] border border-line bg-soft p-4 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("help.locationSelected")}</p>
                    <p className="mt-1 font-semibold text-ink">{selectedLocationLabel ?? "—"}</p>
                    {includeCoords && coords && (
                      <p className="mt-1 text-xs text-muted">{t("help.coordsDetected", { lat: coords.latitude.toFixed(5), lng: coords.longitude.toFixed(5) })}</p>
                    )}
                  </div>

                  <label className="block">
                    <span className="text-sm font-semibold">{t("help.topic")}</span>
                    <select value={topic} onChange={(event) => setTopic(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink">
                      <option value="">—</option>
                      {topics.map((value) => {
                        const key: TranslationKey = `labels.topics.${value}`;
                        return <option key={value} value={value}>{t(key)}</option>;
                      })}
                    </select>
                    <span className="mt-1.5 block text-xs text-muted">{t("help.topicHint")}</span>
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold">{t("help.concern")}</span>
                    <textarea value={concern} onChange={(event) => setConcern(event.target.value)} maxLength={2000} rows={4} placeholder={t("help.concernPlaceholder")} className="mt-2 w-full resize-y rounded-xl border border-line bg-paper px-3 py-3 text-sm leading-relaxed outline-none placeholder:text-muted/70 focus:border-pink" />
                    <span className="mt-1.5 block text-xs leading-relaxed text-muted">{t("help.concernHint")}</span>
                  </label>

                  <div className="space-y-3 rounded-[var(--radius-card)] border border-line bg-soft p-4">
                    <label className="flex items-start gap-3 text-sm">
                      <input type="checkbox" checked={anonymous} onChange={(event) => { const next = event.target.checked; setAnonymous(next); if (next) { setConsent(false); setContact(""); } }} className="mt-1 h-4 w-4 accent-[var(--brand-pink)]" />
                      <span><span className="font-semibold">{t("help.anonymous")}</span><span className="mt-0.5 block text-xs text-muted">{t("help.anonymousHint")}</span></span>
                    </label>
                    <label className={`flex items-start gap-3 text-sm ${anonymous ? "opacity-45" : ""}`}>
                      <input type="checkbox" disabled={anonymous} checked={consent && !anonymous} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-[var(--brand-pink)]" />
                      <span><span className="font-semibold">{t("help.consent")}</span><span className="mt-0.5 block text-xs leading-relaxed text-muted">{t("help.consentHint")}</span></span>
                    </label>
                    {consent && !anonymous && (
                      <label className="block">
                        <span className="text-sm font-semibold">{t("help.contact")}</span>
                        <input value={contact} onChange={(event) => setContact(event.target.value)} maxLength={100} autoComplete="off" className="mt-2 min-h-12 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none focus:border-pink" />
                        <span className="mt-1.5 block text-xs text-muted">{t("help.contactHint")}</span>
                      </label>
                    )}
                  </div>

                  <fieldset>
                    <legend className="text-sm font-semibold">{t("help.priority")}</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {(["NORMAL", "URGENT"] as const).map((value) => {
                        const key: TranslationKey = `labels.priorities.${value}`;
                        return (
                          <label key={value} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${priority === value ? "border-pink bg-pink-soft font-semibold text-pink" : "border-line bg-paper hover:border-pink-line"}`}>
                            <input type="radio" name="priority" value={value} checked={priority === value} onChange={() => setPriority(value)} className="accent-[var(--brand-pink)]" />
                            {t(key)}
                          </label>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted">{t("help.urgencyNote")}</p>
                  </fieldset>

                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => { setError(null); setStep("location"); }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-line px-6 py-3 text-sm font-semibold text-ink transition hover:border-pink-line hover:bg-pink-soft">
                      <ChevronLeft size={17} /> {t("help.back")}
                    </button>
                    <button type="submit" disabled={busy} className="brand-fill inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                      {busy ? t("common.sending") : <><Send size={17} />{t("help.submit")}</>}
                    </button>
                  </div>
                  <p className="flex items-center justify-center gap-2 text-xs text-muted"><Users size={14} className="text-pink" />{t("help.trainedReviews")}</p>
                </form>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
