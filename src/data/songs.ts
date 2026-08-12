import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

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
// Fallback high-quality music metadata if network/iTunes search fails
export const FALLBACK_SONGS: Song[] = [
  {
    "id": "1488408568",
    "title": "Blinding Lights",
    "artist": "The Weeknd",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/17/b4/8f/17b48f9a-0b93-6bb8-fe1d-3a16623c2cfb/mzaf_9560252727299052414.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/a6/6e/bf/a66ebf79-5008-8948-b352-a790fc87446b/19UM1IM04638.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Blinding%20Lights%20The%20Weeknd",
    "album": "Blinding Lights - Single",
    "releaseYear": 2019,
    "genre": "R&B/Soul"
  },
  {
    "id": "1615585008",
    "title": "As It Was",
    "artist": "Harry Styles",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/67/10/16/67101606-3869-ca44-6c03-e13d6322cb51/mzaf_1135399237022217274.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/2a/19/fb/2a19fb85-2f70-9e44-f2a9-82abe679b88e/886449990061.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/As%20It%20Was%20Harry%20Styles",
    "album": "Harry's House",
    "releaseYear": 2022,
    "genre": "Pop"
  },
  {
    "id": "1450695739",
    "title": "bad guy",
    "artist": "Billie Eilish",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/c3/87/1f/c3871f7e-3260-d615-1c66-5fdca2c3a48f/mzaf_10721331211699880949.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1a/37/d1/1a37d1b1-8508-54f2-f541-bf4e437dda76/19UMGIM05028.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/bad%20guy%20Billie%20Eilish",
    "album": "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?",
    "releaseYear": 2019,
    "genre": "Alternative"
  },
  {
    "id": "1440650711",
    "title": "Bohemian Rhapsody",
    "artist": "Queen",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/8f/11/52/8f1152a9-fd5f-0021-f546-b97579c22ec3/mzaf_3962258993076347789.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/4d/08/2a/4d082a9e-7898-1aa1-a02f-339810058d9e/14DMGIM05632.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Bohemian%20Rhapsody%20Queen",
    "album": "Greatest Hits I, II & III: The Platinum Collection",
    "releaseYear": 1975,
    "genre": "Rock"
  },
  {
    "id": "1674691586",
    "title": "Flowers",
    "artist": "Miley Cyrus",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/68/9e/f7/689ef7fe-14fe-a846-c87f-7d3b2d6344b1/mzaf_4167137058064023087.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/8c/67/ff/8c67ff91-31c3-3fef-1884-ce3ec89f3af4/196589946874.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Flowers%20Miley%20Cyrus",
    "album": "Endless Summer Vacation",
    "releaseYear": 2023,
    "genre": "Pop"
  },
  {
    "id": "1440783625",
    "title": "Smells Like Teen Spirit",
    "artist": "Nirvana",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/a6/53/1e/a6531efa-397c-eb73-ecab-9b2790c1471e/mzaf_16440344883389407474.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/95/fd/b9/95fdb9b2-6d2b-92a6-97f2-51c1a6d77f1a/00602527874609.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Smells%20Like%20Teen%20Spirit%20Nirvana",
    "album": "Nevermind",
    "releaseYear": 1991,
    "genre": "Rock"
  },
  {
    "id": "269573364",
    "title": "Billie Jean",
    "artist": "Michael Jackson",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/dc/bc/8a/dcbc8a3e-4ce1-c00d-cc02-eda2212053c7/mzaf_8347559338388601510.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/32/4f/fd/324ffda2-9e51-8f6a-0c2d-c6fd2b41ac55/074643811224.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Billie%20Jean%20Michael%20Jackson",
    "album": "Thriller",
    "releaseYear": 1982,
    "genre": "Pop"
  },
  {
    "id": "1422648513",
    "title": "Dancing Queen",
    "artist": "ABBA",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/1a/47/93/1a4793fc-1586-87bc-00d2-dc4916a61c7c/mzaf_13920610926910283055.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/60/f8/a6/60f8a6bc-e875-238d-f2f8-f34a6034e6d2/14UMGIM07615.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Dancing%20Queen%20ABBA",
    "album": "ABBA Gold: Greatest Hits",
    "releaseYear": 1976,
    "genre": "Pop"
  },
  {
    "id": "943946671",
    "title": "Uptown Funk (feat. Bruno Mars)",
    "artist": "Mark Ronson",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/62/e1/98/62e19826-cd13-6eff-390e-dbca502bb7b5/mzaf_8006535252627949661.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/7e/30/c5/7e30c572-aa47-5f7b-c6fd-42d50cd2c56d/886444959797.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Uptown%20Funk%20%28feat.%20Bruno%20Mars%29%20Mark%20Ronson",
    "album": "Uptown Special",
    "releaseYear": 2014,
    "genre": "Pop"
  },
  {
    "id": "1440933517",
    "title": "Blank Space",
    "artist": "Taylor Swift",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/79/55/b1/7955b10c-6cb6-462a-861c-8e5cbcacfb76/mzaf_3395570742482345989.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a7/98/d8/a798d867-344d-2bf2-fbfe-d2d1412dcef8/14UMDIM03793.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Blank%20Space%20Taylor%20Swift",
    "album": "1989 (Deluxe Edition)",
    "releaseYear": 2014,
    "genre": "Pop"
  },
  {
    "id": "617154366",
    "title": "Get Lucky",
    "artist": "Daft Punk, Pharrell Williams & Nile Rodgers",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/d4/d3/1e/d4d31eb4-7405-b806-8346-3c52ad5b4cf4/mzaf_8095545455942962509.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Get%20Lucky%20Daft%20Punk%2C%20Pharrell%20Williams%20%26%20Nile%20Rodgers",
    "album": "Random Access Memories",
    "releaseYear": 2013,
    "genre": "Pop"
  },
  {
    "id": "1544491233",
    "title": "Rolling in the Deep",
    "artist": "Adele",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/9f/07/1d/9f071dc7-791c-c869-dfa2-06b25936a287/mzaf_11077490630806345321.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/eb/ca/25/ebca2596-cd1e-b295-91a3-771c868d0a79/191404113868.png/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Rolling%20in%20the%20Deep%20Adele",
    "album": "21",
    "releaseYear": 2010,
    "genre": "Pop"
  },
  {
    "id": "1193701392",
    "title": "Shape of You",
    "artist": "Ed Sheeran",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/44/c7/4f/44c74f0d-72dc-6143-d4d0-ba14d661ca0d/mzaf_9566898362556366703.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/15/e6/e8/15e6e8a4-4190-6a8b-86c3-ab4a51b88288/190295851286.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Shape%20of%20You%20Ed%20Sheeran",
    "album": "÷ (Deluxe)",
    "releaseYear": 2017,
    "genre": "Pop"
  },
  {
    "id": "1122773680",
    "title": "Viva La Vida",
    "artist": "Coldplay",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/2b/04/65/2b0465c3-2db1-e461-2362-14b528456b8f/mzaf_1805426141027060154.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/52/aa/85/52aa851f-15b7-6322-f91f-df84b15b7b19/190295978044.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Viva%20La%20Vida%20Coldplay",
    "album": "Viva La Vida or Death and All His Friends",
    "releaseYear": 2008,
    "genre": "Alternative"
  },
  {
    "id": "1642622642",
    "title": "Sweet Child O' Mine (Live In New York, Ritz Theatre - May 16, 1991)",
    "artist": "Guns N' Roses",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/ec/f3/23/ecf323b4-4df6-e514-8fec-fc079ab1a1c3/mzaf_10703798886740471688.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/36/d2/a7/36d2a729-330f-091f-334a-ca64d2d40d45/22UMGIM77901.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Sweet%20Child%20O%27%20Mine%20%28Live%20In%20New%20York%2C%20Ritz%20Theatre%20-%20May%2016%2C%201991%29%20Guns%20N%27%20Roses",
    "album": "Use Your Illusion (Super Deluxe)",
    "releaseYear": 1991,
    "genre": "Hard Rock"
  },
  {
    "id": "1538003843",
    "title": "Levitating",
    "artist": "Dua Lipa",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/59/dc/4d/59dc4dda-93ff-8f1c-c536-f005f6ea6af5/mzaf_3066686759813252385.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/6c/11/d6/6c11d681-aa3a-d59e-4c2e-f77e181026ab/190295092665.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Levitating%20Dua%20Lipa",
    "album": "Future Nostalgia",
    "releaseYear": 2020,
    "genre": "Pop"
  },
  {
    "id": "573962551",
    "title": "Locked Out of Heaven",
    "artist": "Bruno Mars",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/f4/37/44/f4374481-e6e8-54d1-32ad-893ec2f4d495/mzaf_3915415747653767603.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e0/a4/7c/e0a47c6f-005a-9f9f-ce29-8e858e2bcfcb/075679957283.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Locked%20Out%20of%20Heaven%20Bruno%20Mars",
    "album": "Unorthodox Jukebox",
    "releaseYear": 2012,
    "genre": "Pop"
  },
  {
    "id": "1441154437",
    "title": "Umbrella (feat. JAŸ-Z)",
    "artist": "Rihanna",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/7b/45/22/7b452241-882c-409b-3a9b-23306b14286a/mzaf_8588243939716013218.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/2b/c0/81/2bc081c8-25f0-ba43-d451-587a54613778/16UMGIM59202.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Umbrella%20%28feat.%20JA%C5%B8-Z%29%20Rihanna",
    "album": "Good Girl Gone Bad: Reloaded",
    "releaseYear": 2007,
    "genre": "Pop"
  },
  {
    "id": "1577631231",
    "title": "Poker Face",
    "artist": "Lady Gaga",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/06/b8/ac/06b8acb3-7f5e-3302-0781-952eb834e27a/mzaf_17151548762072495969.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/35/0d/d6/350dd697-4b78-8aaf-cf65-74b96c1adab8/21UMGIM68808.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Poker%20Face%20Lady%20Gaga",
    "album": "Girl Power",
    "releaseYear": 2008,
    "genre": "Pop"
  },
  {
    "id": "716192625",
    "title": "Firework",
    "artist": "Katy Perry",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ab/27/3b/ab273b22-1eb1-dd49-5332-5ef70c35683b/mzaf_4912325324633099647.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/c8/d3/42/c8d342af-26d9-3ec2-c511-e1eaf860e299/13UABIM57787.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Firework%20Katy%20Perry",
    "album": "Teenage Dream",
    "releaseYear": 2010,
    "genre": "Pop"
  },
  {
    "id": "296016893",
    "title": "Halo",
    "artist": "Beyoncé",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/a4/4e/1c/a44e1cce-6df2-b9c9-8915-35f7f03c7830/mzaf_2947807885494696932.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/35/0f/55/350f55da-2104-162a-5872-cb35fef30410/mzi.morbeoaw.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Halo%20Beyonc%C3%A9",
    "album": "I AM...SASHA FIERCE",
    "releaseYear": 2008,
    "genre": "Pop"
  },
  {
    "id": "1441493608",
    "title": "Mirrors",
    "artist": "Justin Timberlake",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/07/47/cc/0747ccec-20fe-0617-3639-4381c4910e44/mzaf_16058569210401542525.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/53/74/c9/5374c99e-cff1-61a6-ca0f-fa1219d050a0/886443854406.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Mirrors%20Justin%20Timberlake",
    "album": "The 20/20 Experience (Deluxe Version)",
    "releaseYear": 2013,
    "genre": "Pop"
  },
  {
    "id": "1411628233",
    "title": "Believer",
    "artist": "Imagine Dragons",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/c0/3f/36/c03f367a-b66b-fd0a-a54c-30f8250c4410/mzaf_12768434238801682952.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/11/7a/b8/117ab805-6811-8929-18b9-0fad7baf0c25/17UMGIM98210.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Believer%20Imagine%20Dragons",
    "album": "Evolve",
    "releaseYear": 2017,
    "genre": "Alternative"
  },
  {
    "id": "1440891171",
    "title": "Mr. Brightside",
    "artist": "The Killers",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/c3/a0/30/c3a03008-17c5-aa29-6c6a-5e757ccdbaa5/mzaf_6073120660767081787.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/11/64/9c/11649c80-2066-dba8-77a9-df7eecae26c1/17UM1IM06937.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Mr.%20Brightside%20The%20Killers",
    "album": "Direct Hits",
    "releaseYear": 2003,
    "genre": "Rock"
  },
  {
    "id": "663097965",
    "title": "Do I Wanna Know?",
    "artist": "Arctic Monkeys",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/b2/df/5c/b2df5c8f-af5d-646a-663c-c15eede6b48e/mzaf_4729988752193461592.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Do%20I%20Wanna%20Know%3F%20Arctic%20Monkeys",
    "album": "AM",
    "releaseYear": 2013,
    "genre": "Alternative"
  },
  {
    "id": "590423552",
    "title": "Numb",
    "artist": "LINKIN PARK",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/bb/13/76/bb1376a7-4db0-ed68-c1a6-d0278cc4b320/mzaf_17832584344687833283.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/13/44/05/134405bd-9e27-a678-8953-b5f724201f95/093624948988.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Numb%20LINKIN%20PARK",
    "album": "Meteora (Deluxe Edition)",
    "releaseYear": 2003,
    "genre": "Hard Rock"
  },
  {
    "id": "1440903439",
    "title": "Lose Yourself",
    "artist": "Eminem",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/62/0a/a5/620aa56f-189e-708a-80f0-cebdada3872e/mzaf_7131619873177773332.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/08/23/fc/0823fcd9-cb44-695b-32bf-b3bf51d9f800/00606949351229.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Lose%20Yourself%20Eminem",
    "album": "8 Mile (Music from and Inspired By the Motion Picture)",
    "releaseYear": 2002,
    "genre": "Soundtrack"
  },
  {
    "id": "1032178989",
    "title": "Hey Ya!",
    "artist": "Outkast",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/b5/13/a7/b513a7b2-7339-7b84-ad01-fc4c673f8148/mzaf_9987159911622159815.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a3/35/54/a33554b6-4122-cdfd-29e8-d17897280263/dj.yiwizfgg.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Hey%20Ya%21%20Outkast",
    "album": "00s Party Mixtape",
    "releaseYear": 2003,
    "genre": "Pop"
  },
  {
    "id": "1810879778",
    "title": "Boulevard of Broken Dreams",
    "artist": "Sparrow Sleeps",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/52/d0/23/52d0231b-b13d-e73b-aeb7-1c74488bd391/mzaf_15558090661647349499.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/49/f3/08/49f308bf-478c-629e-8f50-4d1980ca59f9/5063740367982_cover.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Boulevard%20of%20Broken%20Dreams%20Sparrow%20Sleeps",
    "album": "American Infant: Lullaby covers of Green Day's American Idiot",
    "releaseYear": 2025,
    "genre": "Children's Music"
  },
  {
    "id": "266377010",
    "title": "Last Nite",
    "artist": "The Strokes",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/2e/e7/74/2ee774ae-2257-3220-3b87-2306d88324b4/mzaf_16463872203751091452.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Features115/v4/ea/04/d4/ea04d45d-6f5d-ede6-fb64-71f3e6a6e62f/dj.ojkzzidd.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Last%20Nite%20The%20Strokes",
    "album": "Is This It",
    "releaseYear": 2001,
    "genre": "Alternative"
  },
  {
    "id": "202272624",
    "title": "Dreams",
    "artist": "Fleetwood Mac",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/b6/5a/4b/b65a4b6f-54dd-ee99-0b36-98e27d5b5dd8/mzaf_13813391014293209258.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/d2/48/f4/d248f4ae-a7e4-a48e-1588-6617de3e8d76/mzi.izeorbmm.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Dreams%20Fleetwood%20Mac",
    "album": "Greatest Hits",
    "releaseYear": 1987,
    "genre": "Rock"
  },
  {
    "id": "1441164589",
    "title": "Here Comes the Sun",
    "artist": "The Beatles",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/e7/bf/a0/e7bfa041-6e35-be4e-276e-df489781b5d4/mzaf_1668350712755343495.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/df/db/61/dfdb615d-47f8-06e9-9533-b96daccc029f/18UMGIM31076.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Here%20Comes%20the%20Sun%20The%20Beatles",
    "album": "Abbey Road (Remastered)",
    "releaseYear": 1969,
    "genre": "Rock"
  },
  {
    "id": "1452863597",
    "title": "Tiny Dancer",
    "artist": "Elton John",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/24/5b/6d/245b6dcb-098e-40ff-3d5d-b795b55410bf/mzaf_12791161787497744077.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/f1/2a/0a/f12a0a94-5c3f-82d7-4faf-38873cbf77fe/06UMGIM01420.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Tiny%20Dancer%20Elton%20John",
    "album": "To Be Continued (Box Set)",
    "releaseYear": 1971,
    "genre": "Rock"
  },
  {
    "id": "1440808985",
    "title": "Superstition",
    "artist": "Stevie Wonder",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/ff/a3/1a/ffa31a9f-8d91-68a8-e85c-cf8e74284079/mzaf_15951061299338017971.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/62/61/61/626161c0-f4d7-e6ff-8586-768340ef278f/00602537002382.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Superstition%20Stevie%20Wonder",
    "album": "Talking Book",
    "releaseYear": 1972,
    "genre": "R&B/Soul"
  },
  {
    "id": "1255089792",
    "title": "Heroes (Single Version)",
    "artist": "David Bowie",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/4b/a8/39/4ba83913-d7a9-0cff-b287-78c599c0e43f/mzaf_2879061655195715459.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/f0/fe/1b/f0fe1bbe-2dc6-f6a5-8eea-c9221ef4158a/190295842246.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Heroes%20%28Single%20Version%29%20David%20Bowie",
    "album": "Re:Call 3",
    "releaseYear": 1977,
    "genre": "Rock"
  },
  {
    "id": "1440882897",
    "title": "Every Breath You Take",
    "artist": "The Police",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/6c/b4/79/6cb47947-0860-8788-95b1-a2b0a908f342/mzaf_4654925634744235278.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/42/b7/db/42b7dbe1-d13f-c600-5b78-daa57c5d0f08/06UMGIM50761.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Every%20Breath%20You%20Take%20The%20Police",
    "album": "The Very Best of Sting & The Police",
    "releaseYear": 1983,
    "genre": "Rock"
  },
  {
    "id": "840431935",
    "title": "I Wanna Dance with Somebody (Who Loves Me)",
    "artist": "Whitney Houston",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/7b/67/fd/7b67fd07-6a7a-0362-135c-878ac5799f2c/mzaf_11309521725869189721.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/86/b5/25/86b525b1-bff1-4bf6-6112-531251b3d672/dj.hthdmusj.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/I%20Wanna%20Dance%20with%20Somebody%20%28Who%20Loves%20Me%29%20Whitney%20Houston",
    "album": "Whitney",
    "releaseYear": 1987,
    "genre": "R&B/Soul"
  },
  {
    "id": "83445997",
    "title": "Like a Prayer",
    "artist": "Madonna",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/0b/23/82/0b238289-52e2-2107-5531-181836267ed2/mzaf_6726729811402686020.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/20/3c/f5/203cf53d-689e-528f-29d7-ba33758254aa/mzi.rotbotfl.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Like%20a%20Prayer%20Madonna",
    "album": "Like a Prayer",
    "releaseYear": 1989,
    "genre": "Pop"
  },
  {
    "id": "1229320478",
    "title": "Purple Rain",
    "artist": "Prince & The Revolution",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/4a/70/9b/4a709b41-3c29-626a-ca69-44aa907f4705/mzaf_14388295257133509788.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/c1/b6/79/c1b679f5-d59d-1b3e-62ab-514de20f06c6/093624912002.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Purple%20Rain%20Prince%20%26%20The%20Revolution",
    "album": "Purple Rain (Deluxe Expanded Edition) [2015 Paisley Park Remaster]",
    "releaseYear": 1984,
    "genre": "Pop"
  },
  {
    "id": "169003415",
    "title": "Don't Stop Believin' (2024 Remaster)",
    "artist": "Journey",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/5c/72/97/5c72974f-6022-f760-ad82-35964fb636b5/mzaf_12752096049347330756.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/71/2d/61/712d617d-f4a4-5904-1b11-d4b4b45c47c5/828768588925.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Don%27t%20Stop%20Believin%27%20%282024%20Remaster%29%20Journey",
    "album": "Greatest Hits (2024 Remaster)",
    "releaseYear": 1981,
    "genre": "Rock"
  },
  {
    "id": "1422955211",
    "title": "Livin' On a Prayer",
    "artist": "Bon Jovi",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/75/15/30/75153020-b7c4-7958-8907-4aa1b965dc24/mzaf_2377504467597068152.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/40/16/3e/40163e24-6985-b785-d4ea-cbae07d74812/06UMGIM05422.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Livin%27%20On%20a%20Prayer%20Bon%20Jovi",
    "album": "Slippery When Wet",
    "releaseYear": 1986,
    "genre": "Hard Rock"
  },
  {
    "id": "1517447333",
    "title": "Wonderwall",
    "artist": "Oasis",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/ab/16/93/ab16933c-6203-3db9-9da9-513ff1c8496d/mzaf_16993612140334549994.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/04/92/e0/0492e08b-cbcc-9969-9ad6-8f5a0888068c/5051961007107.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Wonderwall%20Oasis",
    "album": "(What's the Story) Morning Glory?",
    "releaseYear": 1995,
    "genre": "Indie Rock"
  },
  {
    "id": "1679849823",
    "title": "Creep (Acoustic)",
    "artist": "Radiohead",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/8d/e0/bb/8de0bb10-0593-83cc-4d2c-4e9f6ea9b575/mzaf_16440589638018943894.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/28/7a/7c/287a7ca9-ed95-1a21-e3bb-4559a1a0ac0e/191404134351.png/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Creep%20%28Acoustic%29%20Radiohead",
    "album": "Creep - EP",
    "releaseYear": 1992,
    "genre": "Alternative"
  },
  {
    "id": "945575413",
    "title": "Californication",
    "artist": "Red Hot Chili Peppers",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/30/57/a2/3057a2dc-cbd7-bea7-66fd-7680c0a47c68/mzaf_7704768448750272219.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4c/86/1d/4c861dab-5428-f3b7-8068-82bb69db5e89/093624932130.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Californication%20Red%20Hot%20Chili%20Peppers",
    "album": "Californication (Remastered)",
    "releaseYear": 1999,
    "genre": "Alternative"
  },
  {
    "id": "362133505",
    "title": "Everlong",
    "artist": "Foo Fighters",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/35/25/c7/3525c700-8776-5b4d-fdd2-7754b26c7fbf/mzaf_10256655135081434791.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/68/f5/86/68f586ca-a375-9965-a864-9e227e77ef5b/884977570328.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Everlong%20Foo%20Fighters",
    "album": "The Colour And The Shape",
    "releaseYear": 1997,
    "genre": "Rock"
  },
  {
    "id": "900672609",
    "title": "Take Me to Church",
    "artist": "Hozier",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/fb/95/fe/fb95fea4-aab2-151d-7e2d-a3b2740de243/mzaf_5007348610386911589.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5e/1b/f1/5e1bf1de-e5f1-e73e-0752-e7882b4f2d57/886444718820.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Take%20Me%20to%20Church%20Hozier",
    "album": "Hozier (Expanded Edition)",
    "releaseYear": 2013,
    "genre": "Alternative"
  },
  {
    "id": "1657869393",
    "title": "Kill Bill",
    "artist": "SZA",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/45/2b/ea/452bead6-c7f5-82d4-f5f7-ec876014b4cc/mzaf_2905911853279084717.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/bd/3b/a9/bd3ba9fb-9609-144f-bcfe-ead67b5f6ab3/196589564931.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Kill%20Bill%20SZA",
    "album": "SOS",
    "releaseYear": 2022,
    "genre": "R&B/Soul"
  },
  {
    "id": "1675173768",
    "title": "Pink Pony Club",
    "artist": "Chappell Roan",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/fc/52/be/fc52be82-306b-6da5-286b-61056757c008/mzaf_1618848737251148796.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/41/bc/fb/41bcfb43-91d5-931d-5747-fb381803143f/23UMGIM21715.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Pink%20Pony%20Club%20Chappell%20Roan",
    "album": "Pink Pony Club - Single",
    "releaseYear": 2020,
    "genre": "Pop"
  },
  {
    "id": "1440870375",
    "title": "Starboy (feat. Daft Punk)",
    "artist": "The Weeknd",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/71/d6/1171d6ad-3c96-e027-2af6-58028426588c/mzaf_15137631797407745471.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b5/92/bb/b592bb72-52e3-e756-9b26-9f56d08f47ab/16UMGIM67864.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/Starboy%20%28feat.%20Daft%20Punk%29%20The%20Weeknd",
    "album": "Starboy",
    "releaseYear": 2016,
    "genre": "R&B/Soul"
  },
  {
    "id": "1440882165",
    "title": "HUMBLE.",
    "artist": "Kendrick Lamar",
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/30/3f/27/303f27c8-1997-8c57-66b3-b67e7c720779/mzaf_5598476068977070849.plus.aac.p.m4a",
    "artworkUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/ab/16/ef/ab16efe9-e7f1-66ec-021c-5592a23f0f9e/17UMGIM88793.rgb.jpg/300x300bb.jpg",
    "spotifyUrl": "https://open.spotify.com/search/HUMBLE.%20Kendrick%20Lamar",
    "album": "DAMN.",
    "releaseYear": 2017,
    "genre": "Hip-Hop/Rap"
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

interface AppleChartSong {
  id: string;
  name: string;
  artistName: string;
}

const APPLE_MUSIC_CHART_URL =
  "https://rss.applemarketingtools.com/api/v2/us/music/most-played/100/songs.json";

/** Returns today's deterministic, pseudo-random position in Apple's 100-song chart. */
export function dailyChartIndex(date = new Date(), chartSize = 100): number {
  if (chartSize <= 0) return 0;
  const utcDay = Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000
  );
  let value = utcDay >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = (value ^ (value >>> 16)) >>> 0;
  return value % chartSize;
}

/**
 * Select from a live 100-song Apple Music chart, then resolve the selected
 * entry through iTunes to obtain the playable preview URL needed by the game.
 */
export async function fetchDailyChartSong(date = new Date()): Promise<Song | null> {
  const response = await fetch(APPLE_MUSIC_CHART_URL);
  if (!response.ok) return null;

  const payload = await response.json();
  const chart = (payload?.feed?.results || []) as AppleChartSong[];
  if (chart.length === 0) return null;

  const selected = chart[dailyChartIndex(date, chart.length)];
  const matches = await searchiTunesSongs(`${selected.name} ${selected.artistName}`);
  return matches.find(
    (song) => song.title.toLowerCase() === selected.name.toLowerCase()
      && song.artist.toLowerCase() === selected.artistName.toLowerCase()
  ) || matches[0] || null;
}

const dailySongKey = (date: Date) => date.toISOString().slice(0, 10);

function storedSong(song: Song): Required<Song> {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    previewUrl: song.previewUrl,
    artworkUrl: song.artworkUrl,
    spotifyUrl: song.spotifyUrl,
    album: song.album,
    releaseYear: song.releaseYear ?? 0,
    genre: song.genre ?? ""
  };
}

/**
 * Reads the shared daily choice first. The first authenticated player of a
 * UTC day atomically persists a chart selection, so later players receive the
 * exact same track even if the live chart changes.
 */
export async function getOrCreateDailySong(date = new Date()): Promise<Song | null> {
  const key = dailySongKey(date);
  const ref = doc(db, "dailySongs", key);
  const existing = await getDoc(ref);
  if (existing.exists()) return existing.data().song as Song;

  const selected = await fetchDailyChartSong(date);
  if (!selected || !auth.currentUser) return selected;

  return runTransaction(db, async (transaction) => {
    const current = await transaction.get(ref);
    if (current.exists()) return current.data().song as Song;

    transaction.set(ref, {
      date: key,
      song: storedSong(selected),
      createdAt: serverTimestamp()
    });
    return selected;
  });
}
