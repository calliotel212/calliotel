/** Episode 1 is open. Episode n opens after episode n - 1 has been opened. */
export function isEpisodeUnlocked(episodeNumber: number, highestOpened: number): boolean {
  return episodeNumber <= highestOpened + 1;
}

export function nextHighest(episodeNumber: number, highestOpened: number): number {
  return Math.max(highestOpened, episodeNumber);
}
