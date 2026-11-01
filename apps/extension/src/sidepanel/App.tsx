import { useState } from "react";
import { useActiveTab, useSettings } from "./hooks";
import { SettingsView } from "./SettingsView";
import { IconButton, Icons } from "./ui";
import { WatchView } from "./WatchView";

/** Chrome side panel: the avatar for the active YouTube tab, and the settings. */
export function App() {
  const [settings, update] = useSettings();
  const { page, remote } = useActiveTab();
  const [view, setView] = useState<"watch" | "settings">("watch");

  if (!settings) return null;

  return (
    <div className="app">
      <header className="header">
        {view === "settings" ? (
          <>
            <IconButton label="Back" onClick={() => setView("watch")}>
              <Icons.back />
            </IconButton>
            <h1 className="header-title centered">Settings</h1>
            <span className="icon-button-spacer" />
          </>
        ) : (
          <>
            <span className="logo" aria-hidden="true">
              <Icons.hand />
            </span>
            <h1 className="header-title">SignStream</h1>
            <IconButton label="Settings" onClick={() => setView("settings")}>
              <Icons.sliders />
            </IconButton>
          </>
        )}
      </header>
      <main className="content">
        {view === "settings" ? (
          <SettingsView settings={settings} update={update} />
        ) : (
          <WatchView settings={settings} update={update} page={page} remote={remote} />
        )}
      </main>
    </div>
  );
}
