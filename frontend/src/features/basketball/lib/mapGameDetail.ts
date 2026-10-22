import type { ApiNbaGameDetail, ApiWnbaGameDetail } from "@/shared/lib/api";
import { resolveNbaTeamColor } from "../league/nbaTeamColors";
import { resolveWnbaTeamColor } from "../league/wnbaTeamColors";
import type {
  GameDetail,
  GameDetailGameLeaders,
  GameDetailSeasonTeamStatLine,
} from "./types";

type ApiBasketballGameDetail = ApiWnbaGameDetail | ApiNbaGameDetail;

function mapTeam(
  team: ApiBasketballGameDetail["away"],
  league: ApiBasketballGameDetail["league"],
) {
  const color =
    league === "nba"
      ? resolveNbaTeamColor(team.abbrev, team.color)
      : resolveWnbaTeamColor(team.abbrev, team.color);

  return {
    id: team.id,
    abbrev: team.abbrev,
    name: team.name,
    score: team.score,
    record: team.record ?? null,
    last10: team.last_10 ?? null,
    color,
    logoUrl: team.logo_url,
  };
}

function mapSeasonTeamStatLine(
  line: NonNullable<ApiBasketballGameDetail["season_team_stats"]>["away"],
): GameDetailSeasonTeamStatLine {
  return {
    pts: line.pts ?? null,
    ptsRank: line.pts_rank ?? null,
    fgPct: line.fg_pct ?? null,
    fgPctRank: line.fg_pct_rank ?? null,
    fg3Pct: line.fg3_pct ?? null,
    fg3PctRank: line.fg3_pct_rank ?? null,
    ftPct: line.ft_pct ?? null,
    ftPctRank: line.ft_pct_rank ?? null,
    reb: line.reb ?? null,
    rebRank: line.reb_rank ?? null,
    ast: line.ast ?? null,
    astRank: line.ast_rank ?? null,
    stl: line.stl ?? null,
    stlRank: line.stl_rank ?? null,
    blk: line.blk ?? null,
    blkRank: line.blk_rank ?? null,
    to: line.to ?? null,
    toRank: line.to_rank ?? null,
    efgPct: line.efg_pct ?? null,
    efgPctRank: line.efg_pct_rank ?? null,
    tsPct: line.ts_pct ?? null,
    tsPctRank: line.ts_pct_rank ?? null,
    astPct: line.ast_pct ?? null,
    astPctRank: line.ast_pct_rank ?? null,
    astTo: line.ast_to ?? null,
    astToRank: line.ast_to_rank ?? null,
    orebPct: line.oreb_pct ?? null,
    orebPctRank: line.oreb_pct_rank ?? null,
    drebPct: line.dreb_pct ?? null,
    drebPctRank: line.dreb_pct_rank ?? null,
    rebPct: line.reb_pct ?? null,
    rebPctRank: line.reb_pct_rank ?? null,
    tovPct: line.tov_pct ?? null,
    tovPctRank: line.tov_pct_rank ?? null,
    offRtg: line.off_rtg ?? null,
    offRtgRank: line.off_rtg_rank ?? null,
    defRtg: line.def_rtg ?? null,
    defRtgRank: line.def_rtg_rank ?? null,
    netRtg: line.net_rtg ?? null,
    netRtgRank: line.net_rtg_rank ?? null,
    pace: line.pace ?? null,
    paceRank: line.pace_rank ?? null,
    pie: line.pie ?? null,
    pieRank: line.pie_rank ?? null,
  };
}

function mapGameLeaders(
  leaders: ApiBasketballGameDetail["game_leaders"],
): GameDetailGameLeaders | null {
  if (!leaders) return null;
  return {
    leaders: leaders.leaders.map((leader) => ({
      key: leader.key,
      label: leader.label,
      rank: leader.rank,
      value: leader.value,
      playerId: leader.player_id,
      lastName: leader.last_name,
      teamAbbrev: leader.team_abbrev,
      side: leader.side,
      headshotUrl: leader.headshot_url,
    })),
  };
}

export function mapGameDetail(detail: ApiBasketballGameDetail): GameDetail {
  return {
    espnEventId: detail.espn_event_id,
    league: detail.league,
    status: detail.status,
    statusLabel: detail.status_label,
    venue: detail.venue,
    gameDate: detail.game_date ?? null,
    broadcast: detail.broadcast ?? null,
    venueCity: detail.venue_city ?? null,
    venueState: detail.venue_state ?? null,
    officials: detail.officials
      ? detail.officials.map((o) => ({ name: o.name, order: o.order }))
      : null,
    away: mapTeam(detail.away, detail.league),
    home: mapTeam(detail.home, detail.league),
    fgMade: detail.fg_made,
    fgAttempted: detail.fg_attempted,
    latestPlay: detail.latest_play
      ? {
          id: detail.latest_play.id,
          clock: detail.latest_play.clock,
          period: detail.latest_play.period,
          text: detail.latest_play.text,
          teamId: detail.latest_play.team_id,
        }
      : null,
    shots: detail.shots.map((shot) => ({
      id: shot.id,
      teamId: shot.team_id,
      playerName: shot.player_name,
      made: shot.made,
      x: shot.x,
      y: shot.y,
      period: shot.period,
      clock: shot.clock,
    })),
    plays: detail.plays.map((play) => ({
      id: play.id,
      teamId: play.team_id,
      period: play.period,
      clock: play.clock,
      text: play.text,
      scoring: play.scoring,
      awayScore: play.away_score,
      homeScore: play.home_score,
      shooting: play.shooting,
    })),
    winProbability: detail.win_probability
      ? {
          summary: detail.win_probability.summary,
          timeline: detail.win_probability.timeline.map((point) => ({
            id: point.id,
            period: point.period,
            clock: point.clock,
            awayScore: point.away_score,
            homeScore: point.home_score,
            awayWinPct: point.away_win_pct,
            homeWinPct: point.home_win_pct,
            teamId: point.team_id,
          })),
          teamStats: detail.win_probability.team_stats.map((stat) => ({
            key: stat.key,
            label: stat.label,
            awayValue: stat.away_value,
            homeValue: stat.home_value,
          })),
        }
      : null,
    matchupPrediction: detail.matchup_prediction
      ? {
          awayWinPct: detail.matchup_prediction.away_win_pct,
          homeWinPct: detail.matchup_prediction.home_win_pct,
          sourceLabel: detail.matchup_prediction.source_label,
        }
      : null,
    projectedStarters: detail.projected_starters
      ? {
          note: detail.projected_starters.note,
          away: detail.projected_starters.away.map((starter) => ({
            jersey: starter.jersey,
            name: starter.name,
            position: starter.position,
            gtd: Boolean(starter.gtd),
          })),
          home: detail.projected_starters.home.map((starter) => ({
            jersey: starter.jersey,
            name: starter.name,
            position: starter.position,
            gtd: Boolean(starter.gtd),
          })),
        }
      : null,
    seasonLeaders: detail.season_leaders
      ? {
          away: detail.season_leaders.away.map((leader) => ({
            stat: leader.stat,
            label: leader.label,
            name: leader.name,
            value: leader.value,
          })),
          home: detail.season_leaders.home.map((leader) => ({
            stat: leader.stat,
            label: leader.label,
            name: leader.name,
            value: leader.value,
          })),
        }
      : null,
    injuries: detail.injuries
      ? {
          away: detail.injuries.away.map((injury) => ({
            name: injury.name,
            position: injury.position,
            status: injury.status,
            detail: injury.detail,
          })),
          home: detail.injuries.home.map((injury) => ({
            name: injury.name,
            position: injury.position,
            status: injury.status,
            detail: injury.detail,
          })),
        }
      : null,
    boxScore: detail.box_score
      ? {
          columns: detail.box_score.columns,
          away: detail.box_score.away.map((player) => ({
            name: player.name,
            didNotPlay: player.did_not_play,
            values: player.values,
          })),
          home: detail.box_score.home.map((player) => ({
            name: player.name,
            didNotPlay: player.did_not_play,
            values: player.values,
          })),
        }
      : null,
    seasonTeamStats: detail.season_team_stats
      ? {
          away: mapSeasonTeamStatLine(detail.season_team_stats.away),
          home: mapSeasonTeamStatLine(detail.season_team_stats.home),
        }
      : null,
    gameLeaders: mapGameLeaders(detail.game_leaders),
  };
}
