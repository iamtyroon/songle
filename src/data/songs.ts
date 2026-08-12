export interface Song {
  id: string;
  title: string;
  artist: string;
  previewUrl: string;
  artworkUrl: string;
  spotifyUrl: string;
  album: string;
  releaseYear?: number;
  genre?: string;
}

// Preset popular songs that we can search for on iTunes to get high-quality 30s previews
export const PRESET_SONG_QUERIES = [
  "The Weeknd Blinding Lights",
  "Harry Styles As It Was",
  "Billie Eilish Bad Guy",
  "Queen Bohemian Rhapsody",
  "Miley Cyrus Flowers",
  "Nirvana Smells Like Teen Spirit",
  "Michael Jackson Billie Jean",
  "ABBA Dancing Queen",
  "Mark Ronson Uptown Funk",
  "Taylor Swift Blank Space",
  "Daft Punk Get Lucky",
  "Adele Rolling in the Deep",
  "Ed Sheeran Shape of You",
  "Coldplay Viva La Vida",
  "Guns N' Roses Sweet Child O' Mine"
];

// Fallback high-quality music metadata if network/iTunes search fails
export const FALLBACK_SONGS: Song[] = [
  {
    id: "1440851722",
    title: "Blinding Lights",
    artist: "The Weeknd",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/37/87/15/37871587-c1cc-6a9c-2965-7489a7fb6d10/mzaf_1130386623674681617.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/37/87/15/37871587-c1cc-6a9c-2965-7489a7fb6d10/19UMGIM70024.rgb.jpg/300x300bb.jpg",
    spotifyUrl: "https://open.spotify.com/track/0VjIjW4GlUZAMY0vGZfI7n",
    album: "After Hours",
    releaseYear: 2019,
    genre: "R&B/Soul"
  },
  {
    id: "1610727024",
    title: "As It Was",
    artist: "Harry Styles",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview112/v4/80/54/1b/80541b52-9705-1a35-fe40-b4df44a958b4/mzaf_11385474343160216127.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/ef/41/d2/ef41d2f8-b3d9-91df-4b71-12ef2c2c069b/886449914446.jpg/300x300bb.jpg",
    spotifyUrl: "https://open.spotify.com/track/4D7g79S6gI9vH9g7696gS9",
    album: "Harry's House",
    releaseYear: 2022,
    genre: "Pop"
  },
  {
    id: "1450663045",
    title: "bad guy",
    artist: "Billie Eilish",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/c6/26/bc/c626bc65-2766-8a7e-cb9a-8a4b3d820d20/mzaf_2080369803153549666.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/c6/26/bc/c626bc65-2766-8a7e-cb9a-8a4b3d820d20/19UMGIM10619.rgb.jpg/300x300bb.jpg",
    spotifyUrl: "https://open.spotify.com/track/2b8fU6F6g3m7H1vD2S9uC6",
    album: "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?",
    releaseYear: 2019,
    genre: "Alternative"
  },
  {
    id: "1440806041",
    title: "Bohemian Rhapsody",
    artist: "Queen",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/f5/db/8e/f5db8e69-026c-d218-ec37-cf4351a63c00/mzaf_2243883181829633851.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/f5/db/8e/f5db8e69-026c-d218-ec37-cf4351a63c00/00602527877292.rgb.jpg/300x300bb.jpg",
    spotifyUrl: "https://open.spotify.com/track/7ldA9g7t8L9XUf9Gv2S9z9",
    album: "A Night at the Opera",
    releaseYear: 1975,
    genre: "Rock"
  },
  {
    id: "1665182526",
    title: "Flowers",
    artist: "Miley Cyrus",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview123/v4/cb/78/3d/cb783d73-207a-d09f-67bc-f698e6fe503f/mzaf_1025547464363223023.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/7c/49/0a/7c490a6f-f230-ec06-efca-96f0b4d45fc4/886449830500.jpg/300x300bb.jpg",
    spotifyUrl: "https://open.spotify.com/track/0y96g8F6g7v7S9S9v6F6X9",
    album: "Endless Summer Vacation",
    releaseYear: 2023,
    genre: "Pop"
  }
];

export async function searchiTunesSongs(query: string): Promise<Song[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&limit=10&entity=song`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((track: any) => ({
      id: String(track.trackId),
      title: track.trackName,
      artist: track.artistName,
      previewUrl: track.previewUrl || "",
      artworkUrl: track.artworkUrl100 ? track.artworkUrl100.replace("100x100bb", "300x300bb") : "",
      spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(track.trackName + " " + track.artistName)}`,
      album: track.collectionName || "",
      releaseYear: track.releaseDate ? new Date(track.releaseDate).getFullYear() : undefined,
      genre: track.primaryGenreName || ""
    }));
  } catch (err) {
    console.error("iTunes search error", err);
    return [];
  }
}
