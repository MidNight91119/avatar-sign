import { SIGN_LANGS } from "@signstream/shared";
import { useState } from "react";
import { API_ORIGIN } from "../config";
import { MAX_OFFSET_SEC, PANEL_SIZES, type Settings } from "../settings";
import { Icons, Row, Segmented, Switch } from "./ui";

export function formatOffset(sec: number): string {
  if (sec === 0) return "0.0 s";
  return `${sec > 0 ? "+" : "−"}${Math.abs(sec).toFixed(1)} s`;
}

const SIZE_OPTIONS = PANEL_SIZES.map((size) => ({
  value: size,
  label: size,
  title: { S: "Small", M: "Medium", L: "Large" }[size],
}));

/** Settings, saved as you change them; open YouTube tabs apply them without a reload. */
export function SettingsView({ settings, update }: { settings: Settings; update: (patch: Partial<Settings>) => void }) {
  const [developerOpen, setDeveloperOpen] = useState(settings.useMockData);

  return (
    <>
      <section className="card group">
        <Row label="SignStream" hint="Show signs on YouTube videos">
          <Switch label="SignStream" checked={settings.enabled} onChange={(enabled) => update({ enabled })} />
        </Row>
        <Row label="Sign language">
          <select
            aria-label="Sign language"
            value={settings.lang}
            onChange={(e) => update({ lang: e.target.value as Settings["lang"] })}
          >
            {SIGN_LANGS.map((lang) => (
              <option key={lang} value={lang}>
                {lang === "ASL" ? "ASL" : `${lang} (soon)`}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Show gloss" hint="The word being signed, under the avatar">
          <Switch label="Show gloss" checked={settings.showGloss} onChange={(showGloss) => update({ showGloss })} />
        </Row>
      </section>

      <section className="card group">
        <Row label="Timing">
          <output className="value" htmlFor="offset">
            {formatOffset(settings.offsetSec)}
          </output>
        </Row>
        <div className="slider-row">
          <input
            id="offset"
            type="range"
            aria-label="Timing offset"
            min={-MAX_OFFSET_SEC}
            max={MAX_OFFSET_SEC}
            step={0.1}
            value={settings.offsetSec}
            onChange={(e) => update({ offsetSec: Number(e.target.value) })}
          />
          <button
            type="button"
            className="button secondary small"
            disabled={settings.offsetSec === 0}
            onClick={() => update({ offsetSec: 0 })}
          >
            Reset
          </button>
        </div>
        <p className="group-note">Move right if the signs lag behind the speech.</p>
      </section>

      <section className="card group">
        <Row label="Panel on the video" hint="Used when this side panel is closed, and in fullscreen">
          <Segmented label="Panel size" options={SIZE_OPTIONS} value={settings.size} onChange={(size) => update({ size })} />
        </Row>
      </section>

      <section className="card group">
        <button
          type="button"
          className="row row-button"
          aria-expanded={developerOpen}
          onClick={() => setDeveloperOpen((open) => !open)}
        >
          <span className="row-label">Developer settings</span>
          <span className="chevron" data-open={developerOpen || undefined}>
            <Icons.chevron />
          </span>
        </button>
        {developerOpen && (
          <>
            <Row label="Demo mode" hint="The team's 60-second demo track on any video, no server needed">
              <Switch label="Demo mode" checked={settings.useMockData} onChange={(useMockData) => update({ useMockData })} />
            </Row>
            <Row label="API server" hint="Set when the extension is built">
              <code className="value">{API_ORIGIN}</code>
            </Row>
          </>
        )}
      </section>

      <p className="footnote">
        <kbd>Alt</kbd> <kbd>S</kbd> turns SignStream on or off
      </p>
    </>
  );
}
