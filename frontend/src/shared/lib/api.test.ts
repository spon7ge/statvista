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

  it("hits /api/wnba/props/today with app format legs", async () => {
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
    const { fetchWnbaProps } = await import("./api");
    await fetchWnbaProps({ app: "prizepicks", format: "power", legs: 4 });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/wnba/props/today?app=prizepicks&format=power&legs=4",
      ),
      expect.anything(),
    );
  });

  it("throws when the response is not ok", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    const { fetchWnbaProps } = await import("./api");
    await expect(
      fetchWnbaProps({ app: "prizepicks", format: "power", legs: 4 }),
    ).rejects.toThrow("Props request failed: 502");
  });
});

describe("fetchWnbaPropBoard", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("GETs /api/wnba/props/board with no query string", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        as_of: "2026-08-31T00:00:00Z",
        rows: [],
        warnings: [],
      }),
    });

    const { fetchWnbaPropBoard } = await import("./api");
    await fetchWnbaPropBoard();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/wnba/props/board",
      expect.objectContaining({
        headers: { Accept: "application/json" },
        cache: "no-store",
      }),
    );
  });

  it("throws when the response is not ok", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({ ok: false, status: 502 });

    const { fetchWnbaPropBoard } = await import("./api");
    await expect(fetchWnbaPropBoard()).rejects.toThrow(
      "WNBA prop board request failed: 502",
    );
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

describe("fetchMlbPropBoard", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("GETs /api/mlb/props/board with no query string", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        as_of: "2026-08-23T00:00:00Z",
        rows: [],
        warnings: [],
      }),
    });

    const { fetchMlbPropBoard } = await import("./api");
    await fetchMlbPropBoard();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/mlb/props/board",
      expect.objectContaining({
        headers: { Accept: "application/json" },
        cache: "no-store",
      }),
    );
  });

  it("throws when the response is not ok", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({ ok: false, status: 502 });

    const { fetchMlbPropBoard } = await import("./api");
    await expect(fetchMlbPropBoard()).rejects.toThrow(
      "MLB prop board request failed: 502",
    );
  });
});

describe("fetchWnbaGameProps", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("requests game props with app query", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        as_of: "2026-08-10T00:00:00Z",
        app: "prizepicks",
        espn_event_id: "401770001",
        away_abbrev: "LVA",
        home_abbrev: "NYL",
        categories: [],
        error: null,
      }),
    });

    const { fetchWnbaGameProps } = await import("./api");
    await fetchWnbaGameProps({ espnEventId: "401770001", app: "prizepicks" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/wnba/props/game/401770001?app=prizepicks",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("throws on non-OK", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    const { fetchWnbaGameProps } = await import("./api");
    await expect(
      fetchWnbaGameProps({ espnEventId: "401770001", app: "underdog" }),
    ).rejects.toThrow("WNBA game props request failed: 500");
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
