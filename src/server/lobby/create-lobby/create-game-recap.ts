import type { GameRecap, GameRecapEvent } from "../../../shared/lobby-types"

const finalRecapSeconds = 10
const scoreStreakSeconds = 5

type CreateGameRecapArgs = {
  events: GameRecapEvent[]
  elapsedSeconds: number
}

export const createGameRecap = ({ events, elapsedSeconds }: CreateGameRecapArgs): GameRecap => {
  const gameOverEvent = [...events].reverse().find((event) => event.type === "gameOver")
  const gameLengthSeconds = gameOverEvent?.elapsedSeconds ?? elapsedSeconds
  const asteroidEvents = events.filter((event) => event.type === "asteroidDestroyed")
  const playerDestroyedEvents = events.filter((event) => event.type === "playerDestroyed")
  const streaks = asteroidEvents.flatMap((event, index) => {
    const streakEvents = asteroidEvents.filter(
      (nextEvent) =>
        nextEvent.player.id === event.player.id &&
        nextEvent.elapsedSeconds >= event.elapsedSeconds &&
        nextEvent.elapsedSeconds - event.elapsedSeconds <= scoreStreakSeconds
    )

    if (streakEvents.length === 0 || asteroidEvents.findIndex((nextEvent) => nextEvent === event) !== index) {
      return []
    }

    return [{
      player: event.player,
      score: streakEvents.reduce((total, streakEvent) => total + streakEvent.scoreDelta, 0),
      asteroidCount: streakEvents.length,
      startedAt: event.elapsedSeconds,
      endedAt: streakEvents.at(-1)?.elapsedSeconds ?? event.elapsedSeconds
    }]
  })
  const biggestScoreStreak = streaks
    .sort((left, right) => right.score - left.score || right.asteroidCount - left.asteroidCount)[0]

  return {
    events,
    highlights: {
      firstPlayerHit: playerDestroyedEvents[0],
      finalAsteroidDestroyed: asteroidEvents.at(-1),
      biggestScoreStreak,
      finalTenSeconds: events.filter((event) => gameLengthSeconds - event.elapsedSeconds <= finalRecapSeconds)
    }
  }
}
