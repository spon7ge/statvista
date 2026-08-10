import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

const okResponse = {
  ok: true,
  status: 200,
  json: async () => ({ date: "2026-07-29", games: [], fetched_at: "now" }),
};

describe("fetchWnbaScoreboard", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses a relative path when VITE_API_BASE_URL is unset", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue(okResponse);

    const { fetchWnbaScoreboard } = await import("./api");
    await fetchWnbaScoreboard();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/wnba/scoreboard/today",
      expect.anything(),
    );
  });

  it("prefixes the configured API origin and strips a trailing slash", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com/");
    fetchMock.mockResolvedValue(okResponse);

    const { fetchWnbaScoreboard } = await import("./api");
    await fetchWnbaScoreboard();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/wnba/scoreboard/today",
      expect.anything(),
    );
  });

  it("throws when the response is not ok", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({ ok: false, status: 502 });

    const { fetchWnbaScoreboard } = await import("./api");
    await expect(fetchWnbaScoreboard()).rejects.toThrow(
      "Scoreboard request failed: 502",
    );
  });
});

describe("fetchGameDetail", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("hits /api/wnba/games/:id", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ espn_event_id: "401857098", league: "wnba" }),
    });
    const { fetchGameDetail } = await import("./api");
    await fetchGameDetail("401857098");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/wnba/games/401857098",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});

describe("fetchWnbaOdds", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("hits /api/wnba/odds/today", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        as_of: "now",
        sportsbook: "draftkings",
        games: [],
      }),
    });
    const { fetchWnbaOdds } = await import("./api");
    await fetchWnbaOdds();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/wnba/odds/today",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("throws when the response is not ok", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    const { fetchWnbaOdds } = await import("./api");
    await expect(fetchWnbaOdds()).rejects.toThrow("Odds request failed: 502");
  });
});

describe("fetchWnbaProps", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("hits /api/wnba/props/today", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        as_of: "now",
        sportsbooks: [
          "fanduel",
          "draftkings",
          "caesars",
          "betmgm",
          "pinnacle",
          "bet365",
          "prizepicks",
          "underdog",
          "betr",
          "novig",
          "sleeper",
          "betrivers",
        ],
        props: [],
      }),
    });
    const { fetchWnbaProps } = await import("./api");
    await fetchWnbaProps();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/wnba/props/today",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("throws when the response is not ok", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    const { fetchWnbaProps } = await import("./api");
    await expect(fetchWnbaProps()).rejects.toThrow("Props request failed: 502");
  });
});

describe("fetchMlbProps", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("requests MLB props with the selected DFS format", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        as_of: "now",
        app: "prizepicks",
        format: "power",
        legs: 4,
        breakeven_pct: 54.3,
        props: [],
        error: null,
      }),
    });

    const { fetchMlbProps } = await import("./api");
    await fetchMlbProps({ app: "prizepicks", format: "power", legs: 4 });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/mlb/props/today?app=prizepicks&format=power&legs=4",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("throws when the response is not ok", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({ ok: false, status: 502 });

    const { fetchMlbProps } = await import("./api");
    await expect(
      fetchMlbProps({ app: "underdog", format: "flex", legs: 5 }),
    ).rejects.toThrow("MLB props request failed: 502");
  });
});

describe("fetchMlbGameProps", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("calls game props endpoint", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        as_of: "2026-08-09T00:00:00Z",
        app: "prizepicks",
        game_pk: "746123",
        away_abbrev: "NYY",
        home_abbrev: "BOS",
        categories: [],
        error: null,
      }),
    });

    const { fetchMlbGameProps } = await import("./api");
    await fetchMlbGameProps({ gamePk: "746123", app: "prizepicks" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/mlb/props/game/746123?app=prizepicks",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("throws when the response is not ok", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({ ok: false, status: 502 });

    const { fetchMlbGameProps } = await import("./api");
    await expect(
      fetchMlbGameProps({ gamePk: "746123", app: "underdog" }),
    ).rejects.toThrow("MLB game props request failed: 502");
  });
});

describe("fetchMlbTeamPreview", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("hits team-preview with side", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        side: "away",
        team: {
          id: "147",
          abbrev: "NYY",
          name: "New York Yankees",
          logo_url: null,
        },
        batting_leaders: [],
        pitching_leaders: [],
        batting_roster: [],
        pitching_roster: [],
      }),
    });

    const { fetchMlbTeamPreview } = await import("./api");
    await fetchMlbTeamPreview({ gamePk: "1", side: "away" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/mlb/games/1/team-preview?side=away",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("throws when the response is not ok", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({ ok: false, status: 502 });

    const { fetchMlbTeamPreview } = await import("./api");
    await expect(
      fetchMlbTeamPreview({ gamePk: "1", side: "home" }),
    ).rejects.toThrow("MLB team preview request failed: 502");
  });
});

describe("fetchWnbaTeamPreview", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("hits team-preview with side", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        side: "away",
        team: {
          id: "16",
          abbrev: "MIN",
          name: "Minnesota Lynx",
          logo_url: null,
        },
        leaders: [],
        roster: [],
      }),
    });

    const { fetchWnbaTeamPreview } = await import("./api");
    await fetchWnbaTeamPreview({ espnEventId: "401734891", side: "away" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/wnba/games/401734891/team-preview?side=away",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("throws when the response is not ok", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({ ok: false, status: 502 });

    const { fetchWnbaTeamPreview } = await import("./api");
    await expect(
      fetchWnbaTeamPreview({ espnEventId: "401734891", side: "home" }),
    ).rejects.toThrow("WNBA team preview request failed: 502");
  });
});

describe("fetchMlbFutures", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("hits /api/mlb/futures", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        season: 2026,
        as_of: "now",
        markets: [],
        error: null,
      }),
    });
    const { fetchMlbFutures } = await import("./api");
    await fetchMlbFutures();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/mlb/futures",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("throws when the response is not ok", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    const { fetchMlbFutures } = await import("./api");
    await expect(fetchMlbFutures()).rejects.toThrow(
      "MLB futures failed: 502",
    );
  });
});

describe("fetchWnbaFutures", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("hits /api/wnba/futures", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        season: 2026,
        as_of: "now",
        markets: [],
        error: null,
      }),
    });
    const { fetchWnbaFutures } = await import("./api");
    await fetchWnbaFutures();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/wnba/futures",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("throws when the response is not ok", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    const { fetchWnbaFutures } = await import("./api");
    await expect(fetchWnbaFutures()).rejects.toThrow(
      "Futures request failed: 502",
    );
  });
});

describe("fetchMlbScoreboard", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses a relative path when VITE_API_BASE_URL is unset", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue(okResponse);

    const { fetchMlbScoreboard } = await import("./api");
    await fetchMlbScoreboard();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/mlb/scoreboard/today",
      expect.anything(),
    );
  });

  it("prefixes the configured API origin and strips a trailing slash", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com/");
    fetchMock.mockResolvedValue(okResponse);

    const { fetchMlbScoreboard } = await import("./api");
    await fetchMlbScoreboard();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/mlb/scoreboard/today",
      expect.anything(),
    );
  });

  it("throws when the response is not ok", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({ ok: false, status: 502 });

    const { fetchMlbScoreboard } = await import("./api");
    await expect(fetchMlbScoreboard()).rejects.toThrow(
      "MLB scoreboard request failed: 502",
    );
  });
});
