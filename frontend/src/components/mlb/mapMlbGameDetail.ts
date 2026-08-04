import type { ApiMlbGameDetail } from "@/lib/api";
import type { MlbGameDetailView, MlbPlay } from "./types";

function mapPlay(play: ApiMlbGameDetail["plays"][number]): MlbPlay {
  return {
    id: play.id,
    inning: play.inning,
    half: play.half,
    text: play.text,
    event: play.event,
    scoring: play.scoring,
    awayScore: play.away_score,
    homeScore: play.home_score,
  };
}

function mapTeam(team: ApiMlbGameDetail["away"]) {
  return {
    id: team.id,
    abbrev: team.abbrev,
    name: team.name,
    score: team.score,
    color: team.color,
    logoUrl: team.logo_url,
  };
}

export function mapMlbGameDetail(detail: ApiMlbGameDetail): MlbGameDetailView {
  return {
    mlbGamePk: detail.mlb_game_pk,
    league: detail.league,
    status: detail.status,
    statusLabel: detail.status_label,
    venue: detail.venue,
    away: mapTeam(detail.away),
    home: mapTeam(detail.home),
    linescore: detail.linescore
      ? {
          currentInning: detail.linescore.current_inning,
          inningHalf: detail.linescore.inning_half,
          innings: detail.linescore.innings.map((inning) => ({
            num: inning.num,
            awayRuns: inning.away_runs,
            homeRuns: inning.home_runs,
          })),
          away: {
            runs: detail.linescore.away.runs,
            hits: detail.linescore.away.hits,
            errors: detail.linescore.away.errors,
          },
          home: {
            runs: detail.linescore.home.runs,
            hits: detail.linescore.home.hits,
            errors: detail.linescore.home.errors,
          },
        }
      : null,
    situation: detail.situation
      ? {
          balls: detail.situation.balls,
          strikes: detail.situation.strikes,
          outs: detail.situation.outs,
          runners: {
            first: detail.situation.runners.first,
            second: detail.situation.runners.second,
            third: detail.situation.runners.third,
          },
          pitches: detail.situation.pitches.map((pitch) => ({
            number: pitch.number,
            type: pitch.type,
            mph: pitch.mph,
            result: pitch.result,
            isStrike: pitch.is_strike,
            zoneX: pitch.zone_x,
            zoneY: pitch.zone_y,
          })),
          atBat: detail.situation.at_bat
            ? {
                name: detail.situation.at_bat.name,
                hand: detail.situation.at_bat.hand,
                summary: detail.situation.at_bat.summary,
              }
            : null,
          onDeck: detail.situation.on_deck
            ? {
                name: detail.situation.on_deck.name,
                hand: detail.situation.on_deck.hand,
                summary: detail.situation.on_deck.summary,
              }
            : null,
          pitching: detail.situation.pitching
            ? {
                name: detail.situation.pitching.name,
                hand: detail.situation.pitching.hand,
                summary: detail.situation.pitching.summary,
              }
            : null,
          latestPlayText: detail.situation.latest_play_text,
        }
      : null,
    plays: detail.plays.map(mapPlay),
    scoringPlays: detail.scoring_plays.map(mapPlay),
    boxScore: detail.box_score
      ? {
          awayBatters: detail.box_score.away_batters.map((row) => ({
            name: row.name,
            position: row.position,
            order: row.order,
            ab: row.ab,
            r: row.r,
            h: row.h,
            rbi: row.rbi,
            bb: row.bb,
            so: row.so,
            hr: row.hr,
            sb: row.sb,
          })),
          homeBatters: detail.box_score.home_batters.map((row) => ({
            name: row.name,
            position: row.position,
            order: row.order,
            ab: row.ab,
            r: row.r,
            h: row.h,
            rbi: row.rbi,
            bb: row.bb,
            so: row.so,
            hr: row.hr,
            sb: row.sb,
          })),
          awayPitchers: detail.box_score.away_pitchers.map((row) => ({
            name: row.name,
            ip: row.ip,
            h: row.h,
            r: row.r,
            er: row.er,
            bb: row.bb,
            k: row.k,
            pitches: row.pitches,
          })),
          homePitchers: detail.box_score.home_pitchers.map((row) => ({
            name: row.name,
            ip: row.ip,
            h: row.h,
            r: row.r,
            er: row.er,
            bb: row.bb,
            k: row.k,
            pitches: row.pitches,
          })),
        }
      : null,
    winProbability: detail.win_probability
      ? {
          awayAbbrev: detail.win_probability.away_abbrev,
          homeAbbrev: detail.win_probability.home_abbrev,
          points: detail.win_probability.points.map((point) => ({
            playId: point.play_id,
            label: point.label,
            homeWinPct: point.home_win_pct,
          })),
          stakes: detail.win_probability.stakes
            ? {
                label: detail.win_probability.stakes.label,
                homeWinDelta: detail.win_probability.stakes.home_win_delta,
              }
            : null,
        }
      : null,
    hitChart: detail.hit_chart.map((point) => ({
      id: point.id,
      team: point.team,
      playerName: point.player_name,
      result: point.result,
      x: point.x,
      y: point.y,
    })),
    sources: detail.sources,
    fetchedAt: detail.fetched_at,
  };
}
