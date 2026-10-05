import { describe, it, expect, beforeAll } from "vitest";
import {
  collectUnusedSiblings,
  selectWhatIfCards,
  labelRevealsEndingTitle,
  endingTitlesFor,
  frameTease,
  pathForReplayFrom,
  renderWhatIfMapHtml,
  isOutlineIshLabel,
} from "../src/whatIf.js";
import { getStory, STORIES } from "../src/stories/index.js";
import { isEnding } from "../src/engine.js";

/** Prefer first choice at each fork → deterministic a-path to an ending. */
function aPath(story) {
  const path = [story.startSceneId];
  let cur = story.startSceneId;
  const guard = new Set();
  while (story.scenes[cur] && !isEnding(story.scenes[cur])) {
    if (guard.has(cur)) break;
    guard.add(cur);
    const choices = story.scenes[cur].choices || [];
    if (!choices.length) break;
    const next = choices[0].id;
    path.push(next);
    cur = next;
  }
  return path;
}

describe("what-if pure selection", () => {
  it("collects unused siblings along a path", () => {
    const story = getStory("until-the-quiet-breaks");
    const path = aPath(story);
    const unused = collectUnusedSiblings(story, path, "warm");
    expect(unused.length).toBeGreaterThanOrEqual(3);
    expect(unused.every((u) => u.label && u.sceneId && u.choiceId)).toBe(true);
    // scene1 took 2a → unused is 2b
    expect(unused.some((u) => u.sceneId === "scene1" && u.choiceId === "scene2b")).toBe(true);
  });

  it("caps at 2–3, one per scene, prefers later layers, is deterministic", () => {
    const story = getStory("until-the-quiet-breaks");
    const path = aPath(story);
    const a = selectWhatIfCards(story, path, { spice: "warm", max: 3 });
    const b = selectWhatIfCards(story, path, { spice: "warm", max: 3 });
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(2);
    expect(a.length).toBeLessThanOrEqual(3);
    const scenes = a.map((c) => c.sceneId);
    expect(new Set(scenes).size).toBe(scenes.length);
    // Later layers preferred: first card should be among the highest layers available
    const unused = collectUnusedSiblings(story, path);
    const maxLayer = Math.max(...unused.map((u) => u.layer));
    expect(a[0].layer).toBe(maxLayer);
  });

  it("skips labels that reveal ending titles", () => {
    const titles = ["Together in Truth", "Soft Rebuild", "Open Secret"];
    expect(labelRevealsEndingTitle("Choose together in truth at dawn", titles)).toBe(true);
    expect(labelRevealsEndingTitle("Walk to Willow Lane — face Henry first", titles)).toBe(false);
    const story = getStory("what-the-sister-kept");
    const titles2 = endingTitlesFor(story);
    expect(titles2.some((t) => /truth/i.test(t))).toBe(true);
    // Force a path whose L9 unused sibling names an ending — selection must skip it
    const path = aPath(story);
    const cards = selectWhatIfCards(story, path, { spice: "warm", max: 3 });
    for (const c of cards) {
      expect(labelRevealsEndingTitle(c.label, titles2)).toBe(false);
      expect(c.tease).not.toMatch(/Together in Truth/i);
    }
  });

  it("frames teases without dumping prose", () => {
    expect(frameTease("Ask John to walk you to Willow")).toBe(
      "What if you had… Ask John to walk you to Willow"
    );
    expect(frameTease("What if you stayed")).toBe("What if you stayed");
  });

  it("pathForReplayFrom trims to the fork", () => {
    const path = ["scene1", "scene2a", "scene3a", "scene4a", "scene10a"];
    expect(pathForReplayFrom(path, "scene3a")).toEqual(["scene1", "scene2a", "scene3a"]);
  });

  it("authored overrides win when valid", () => {
    const story = getStory("until-the-quiet-breaks");
    const path = aPath(story);
    const cards = selectWhatIfCards(story, path, {
      overrides: [
        { sceneId: "scene1", target: "scene2b", tease: "What if Henry came first?" },
        { sceneId: "scene5a", choiceIndex: 1 },
      ],
    });
    expect(cards[0].source).toBe("authored");
    expect(cards[0].tease).toBe("What if Henry came first?");
    expect(cards.length).toBeLessThanOrEqual(3);
  });

  it("renderWhatIfMapHtml has no ad markup", () => {
    const html = renderWhatIfMapHtml(
      [
        {
          sceneId: "scene5a",
          choiceId: "scene6b",
          choiceIndex: 1,
          label: "Hide the ugliest page",
          layer: 5,
          tease: "What if you had… Hide the ugliest page",
          chapterLabel: "Chapter 5",
          source: "derived",
        },
      ],
      { escapeHtml: (s) => String(s) }
    );
    expect(html).toMatch(/data-testid="what-if-map"/);
    expect(html).toMatch(/Replay from here/);
    expect(html).not.toMatch(/adsense|interstitial|data-ad|adsbygoogle/i);
  });
});

describe("what-if for all 4 live stories", () => {
  const slugs = Object.keys(STORIES);

  it("registry has exactly the 4 live stories", () => {
    expect(slugs.sort()).toEqual(
      ["the-living-key", "the-soft-alibi", "until-the-quiet-breaks", "what-the-sister-kept"].sort()
    );
  });

  it.each(slugs)("%s yields 2–3 cards from a real path without ending-title spoilers", (slug) => {
    const story = getStory(slug);
    const path = aPath(story);
    expect(path.length).toBeGreaterThanOrEqual(5);
    expect(isEnding(story.scenes[path[path.length - 1]])).toBe(true);
    const cards = selectWhatIfCards(story, path, { spice: "warm", max: 3 });
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(cards.length).toBeLessThanOrEqual(3);
    const titles = endingTitlesFor(story);
    for (const c of cards) {
      expect(labelRevealsEndingTitle(c.label, titles)).toBe(false);
      expect(c.tease.startsWith("What if") || c.tease.length > 0).toBe(true);
      expect(c.chapterLabel).toMatch(/^Chapter \d+$/);
    }
  });
});

describe("what-if ending screen DOM", () => {
  let mod;
  beforeAll(async () => {
    window.scrollTo = () => {};
    document.body.innerHTML = "<div id=\"app\"></div>";
    mod = await import("../src/main.js");
  });

  it("renders what-if map on ending for each story with a realistic path", () => {
    for (const slug of Object.keys(STORIES)) {
      const story = getStory(slug);
      const path = aPath(story);
      const endingId = path[path.length - 1];
      mod.setState({
        view: "reader",
        storyId: slug,
        sceneId: endingId,
        playerName: "Elena",
        spice: "warm",
        path,
        whatIfHighlightId: "",
        previousSceneId: path[path.length - 2] || "",
      });
      const map = document.querySelector("[data-testid=\"what-if-map\"]");
      expect(map, `${slug} what-if map`).toBeTruthy();
      const cards = document.querySelectorAll("[data-testid=\"what-if-card\"]");
      expect(cards.length).toBeGreaterThanOrEqual(2);
      expect(cards.length).toBeLessThanOrEqual(3);
      expect(map.innerHTML).not.toMatch(/adsense|interstitial|adsbygoogle/i);
      const teases = [...document.querySelectorAll("[data-testid=\"what-if-tease\"]")].map((el) =>
        el.textContent.trim()
      );
      expect(teases.every((t) => t.length > 0)).toBe(true);
    }
  });

  it("Replay from here restores fork path and keeps name+spice with highlight", async () => {
    const story = getStory("until-the-quiet-breaks");
    const path = aPath(story);
    const cards = selectWhatIfCards(story, path, { spice: "hot", max: 3 });
    const target = cards[0];
    mod.setState({
      view: "reader",
      storyId: story.id,
      sceneId: path[path.length - 1],
      playerName: "Elena",
      spice: "hot",
      path,
      whatIfHighlightId: "",
      previousSceneId: path[path.length - 2],
    });
    const btn = document.querySelector(
      `[data-testid="what-if-replay"][data-fork-scene-id="${target.sceneId}"]`
    );
    expect(btn).toBeTruthy();
    btn.click();
    // momentum beat then settle
    await new Promise((r) => setTimeout(r, 350));
    expect(mod.state.playerName).toBe("Elena");
    expect(mod.state.spice).toBe("hot");
    expect(mod.state.sceneId).toBe(target.sceneId);
    expect(mod.state.path).toEqual(pathForReplayFrom(path, target.sceneId));
    expect(mod.state.whatIfHighlightId).toBe(target.choiceId);
    // After momentum, highlighted choice should be present
    await new Promise((r) => setTimeout(r, 50));
    const highlighted = document.querySelector(".choice--what-if-highlight");
    expect(highlighted?.getAttribute("data-choice-id")).toBe(target.choiceId);
  });
});

describe("outline-ish label heuristic (Scribe flags)", () => {
  it("flags colon-prefix planning labels", () => {
    expect(isOutlineIshLabel("Full coop: she withholds one living-key page still")).toBe(true);
    expect(isOutlineIshLabel("Ledger private: she bargains with Isolde")).toBe(true);
    expect(isOutlineIshLabel("Walk to Willow Lane — face Henry first")).toBe(false);
  });
});
