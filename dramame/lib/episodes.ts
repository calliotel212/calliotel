export type PreviewEpisode = {
  number: number;
  title: string;
  wash: string;
};

/**
 * Empty player cards for the scroll preview.
 * These are not a story, not episode scripts, and not a finished show.
 */
export const PREVIEW_SERIES_ID = "preview";

export const PREVIEW_EPISODES: PreviewEpisode[] = [
  { number: 1, title: "Placeholder 01", wash: "linear-gradient(165deg, #14182e 0%, #4361EE 46%, #090B18 78%)" },
  { number: 2, title: "Placeholder 02", wash: "linear-gradient(160deg, #1a1433 0%, #7557FF 48%, #090B18 80%)" },
  { number: 3, title: "Placeholder 03", wash: "linear-gradient(180deg, #090B18 10%, #24306e 52%, #090B18 100%)" },
  { number: 4, title: "Placeholder 04", wash: "linear-gradient(150deg, #2a1830 0%, #7557FF 38%, #4361EE 70%, #090B18 100%)" },
  { number: 5, title: "Placeholder 05", wash: "linear-gradient(200deg, #090B18 0%, #3a2a55 40%, #090B18 100%)" },
  { number: 6, title: "Placeholder 06", wash: "linear-gradient(145deg, #12162c 0%, #4361EE 55%, #1a1024 100%)" },
  { number: 7, title: "Placeholder 07", wash: "linear-gradient(170deg, #241428 0%, #7557FF 42%, #090B18 88%)" },
  { number: 8, title: "Placeholder 08", wash: "linear-gradient(190deg, #090B18 0%, #2c3f86 50%, #3a221f 100%)" },
];
