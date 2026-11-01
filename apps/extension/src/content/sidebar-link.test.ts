import { describe, expect, it } from "bun:test";
import { createSidebarHub, pageInfo, type SidebarLink } from "./sidebar-link";

function fakeLink() {
  const onClose: (() => void)[] = [];
  const link: SidebarLink = { post() {}, onDisconnect: (fn) => void onClose.push(fn) };
  return { link, close: () => onClose.forEach((fn) => fn()) };
}

describe("createSidebarHub", () => {
  it("replays the open side panel to subscribers that arrive late (the app is still starting)", () => {
    const hub = createSidebarHub();
    const { link } = fakeLink();
    hub.accept(link);
    const seen: SidebarLink[] = [];
    hub.subscribe((l) => seen.push(l));
    expect(seen).toEqual([link]);
  });

  it("forgets a side panel once it closes", () => {
    const hub = createSidebarHub();
    const { link, close } = fakeLink();
    hub.accept(link);
    close();
    const seen: SidebarLink[] = [];
    hub.subscribe((l) => seen.push(l));
    expect(seen).toEqual([]);
  });

  it("notifies current subscribers of a new connection", () => {
    const hub = createSidebarHub();
    const seen: SidebarLink[] = [];
    const unsubscribe = hub.subscribe((l) => seen.push(l));
    hub.accept(fakeLink().link);
    unsubscribe();
    hub.accept(fakeLink().link);
    expect(seen.length).toBe(1);
  });
});

describe("pageInfo", () => {
  it("cleans up YouTube's page title", () => {
    document.title = "(3) Never Gonna Give You Up - YouTube";
    expect(pageInfo(document, "https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      route: { kind: "watch", videoId: "dQw4w9WgXcQ" },
      title: "Never Gonna Give You Up",
    });
  });
});
