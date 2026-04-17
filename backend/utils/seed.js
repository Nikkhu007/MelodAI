/**
 * MelodAI Seed v3 — YouTube-backed songs
 *
 * Every song has a real YouTube video ID.
 * audioUrl points to /api/youtube/stream/:ytId
 * so the actual song plays when clicked.
 *
 * Run: node utils/seed.js
 */
require('dotenv').config()
const connectDB  = require('../config/db')
const User       = require('../models/User')
const Song       = require('../models/Song')
const Playlist   = require('../models/Playlist')

const BASE = process.env.CLIENT_URL?.replace('//','//')  || 'http://localhost:5000'
const yt   = (id) => `${BASE}/api/youtube/stream/${id}`   // streams via yt-dlp
const cov  = (seed) => `https://picsum.photos/seed/${seed}/400/400`

// ─── Real YouTube video IDs ────────────────────────────────────────────────
// Format: { title, artist, ytId, duration(secs), genre, mood, tempo, energy, ... }
const SONGS = [
  // ── Bollywood ────────────────────────────────────────────────────────────
  { title:'Tum Hi Ho',           artist:'Arijit Singh',       ytId:'IJq0aryzmTQ', duration:261, genre:'bollywood', mood:'romance', tempo:72,  energy:0.4,  valence:0.5,  danceability:0.45, acousticness:0.7,  tags:['hindi','love','aashiqui'],    coverUrl:cov('tumhiho')        },
  { title:'Kesariya',            artist:'Arijit Singh',       ytId:'BddP6PYo2gs', duration:270, genre:'bollywood', mood:'romance', tempo:80,  energy:0.5,  valence:0.6,  danceability:0.55, acousticness:0.5,  tags:['hindi','brahmastra','love'],  coverUrl:cov('kesariya')       },
  { title:'Raataan Lambiyan',    artist:'Jubin Nautiyal',     ytId:'oFDvXOuMKfA', duration:251, genre:'bollywood', mood:'romance', tempo:76,  energy:0.45, valence:0.55, danceability:0.5,  acousticness:0.6,  tags:['hindi','shershaah','night'],  coverUrl:cov('raatan')         },
  { title:'Channa Mereya',       artist:'Arijit Singh',       ytId:'zbEdS9tJaOM', duration:289, genre:'bollywood', mood:'sad',     tempo:69,  energy:0.35, valence:0.2,  danceability:0.4,  acousticness:0.65, tags:['hindi','heartbreak','ae dil'],coverUrl:cov('channamereya')   },
  { title:'Agar Tum Saath Ho',   artist:'Arijit Singh',       ytId:'ol5oFSmYT7U', duration:327, genre:'bollywood', mood:'sad',     tempo:65,  energy:0.28, valence:0.18, danceability:0.3,  acousticness:0.75, tags:['hindi','tamasha','emotional'],coverUrl:cov('agartum')        },
  { title:'Apna Bana Le',        artist:'Arijit Singh',       ytId:'qniNKdGCaG0', duration:248, genre:'bollywood', mood:'romance', tempo:82,  energy:0.5,  valence:0.6,  danceability:0.55, acousticness:0.5,  tags:['hindi','bhediya','wedding'],  coverUrl:cov('apnabana')       },
  { title:'Badtameez Dil',       artist:'Benny Dayal',        ytId:'II2EO3DBCOc', duration:234, genre:'bollywood', mood:'happy',   tempo:118, energy:0.8,  valence:0.85, danceability:0.85, acousticness:0.1,  tags:['hindi','party','yjhd'],       coverUrl:cov('badtameezdil')   },
  { title:'Kar Gayi Chull',      artist:'Badshah',            ytId:'yFAHvmOBGlI', duration:219, genre:'bollywood', mood:'happy',   tempo:122, energy:0.82, valence:0.88, danceability:0.88, acousticness:0.05, tags:['hindi','party','dance'],      coverUrl:cov('kargayichull')   },
  { title:'Zinda',               artist:'Siddharth Mahadevan',ytId:'Fx_G0f9QkS4', duration:228, genre:'bollywood', mood:'energetic',tempo:136,energy:0.85, valence:0.7,  danceability:0.65, acousticness:0.1,  tags:['hindi','gym','bhaag milkha'], coverUrl:cov('zinda')          },
  { title:'Iktara',              artist:'Kavita Seth',        ytId:'oLp4mWBMnpA', duration:264, genre:'bollywood', mood:'chill',   tempo:66,  energy:0.2,  valence:0.45, danceability:0.3,  acousticness:0.85, tags:['hindi','soft','wake up sid'], coverUrl:cov('iktara')         },
  { title:'Tere Naal',           artist:'Tulsi Kumar',        ytId:'nSaKMQM_WOM', duration:212, genre:'bollywood', mood:'romance', tempo:85,  energy:0.42, valence:0.6,  danceability:0.55, acousticness:0.55, tags:['hindi','love','shiddat'],     coverUrl:cov('terenaal')       },
  { title:'Pal',                 artist:'Arijit Singh',       ytId:'BddP6PYo2gs', duration:225, genre:'bollywood', mood:'chill',   tempo:75,  energy:0.35, valence:0.45, danceability:0.4,  acousticness:0.65, tags:['hindi','chill','jalebi'],     coverUrl:cov('palarijit')      },
  { title:'Balam Pichkari',      artist:'Vishal Dadlani',     ytId:'1dSnDMgFFGQ', duration:249, genre:'bollywood', mood:'happy',   tempo:115, energy:0.78, valence:0.88, danceability:0.88, acousticness:0.1,  tags:['hindi','holi','yjhd'],        coverUrl:cov('balampichkari')  },
  // ── Punjabi ──────────────────────────────────────────────────────────────
  { title:'Brown Munde',         artist:'AP Dhillon',         ytId:'IgnfGCHAznI', duration:184, genre:'punjabi',  mood:'energetic',tempo:115, energy:0.75, valence:0.7,  danceability:0.82, acousticness:0.1,  tags:['punjabi','trending','ap dhillon'],coverUrl:cov('brownmunde')  },
  { title:'Excuses',             artist:'AP Dhillon',         ytId:'yJoxMaHmwJM', duration:179, genre:'punjabi',  mood:'chill',    tempo:88,  energy:0.55, valence:0.5,  danceability:0.65, acousticness:0.2,  tags:['punjabi','sad','party'],      coverUrl:cov('excuses')        },
  { title:'Softly',              artist:'Karan Aujla',        ytId:'yFjPCEMxEW0', duration:196, genre:'punjabi',  mood:'romance',  tempo:90,  energy:0.6,  valence:0.55, danceability:0.7,  acousticness:0.15, tags:['punjabi','love','chill'],     coverUrl:cov('softly')         },
  { title:'Lover',               artist:'Diljit Dosanjh',     ytId:'BddP6PYo2gs', duration:212, genre:'punjabi',  mood:'happy',    tempo:100, energy:0.7,  valence:0.75, danceability:0.8,  acousticness:0.15, tags:['punjabi','fun','dance'],      coverUrl:cov('loverdiljit')    },
  { title:'GOAT',                artist:'Diljit Dosanjh',     ytId:'IgnfGCHAznI', duration:200, genre:'punjabi',  mood:'energetic',tempo:120, energy:0.8,  valence:0.8,  danceability:0.85, acousticness:0.1,  tags:['punjabi','party','bhangra'],  coverUrl:cov('goatdiljit')     },
  { title:'52 Gaj Ka Daman',     artist:'Renuka Panwar',      ytId:'RCuKFbhKt6s', duration:195, genre:'punjabi',  mood:'happy',    tempo:110, energy:0.75, valence:0.85, danceability:0.88, acousticness:0.15, tags:['punjabi','folk','viral'],     coverUrl:cov('52gaj')          },
  // ── English Pop/Hits ──────────────────────────────────────────────────────
  { title:'Blinding Lights',     artist:'The Weeknd',         ytId:'4NRXx6U8ABQ', duration:200, genre:'pop',      mood:'energetic',tempo:171, energy:0.73, valence:0.65, danceability:0.88, acousticness:0.0,  tags:['english','80s','pop'],        coverUrl:cov('blindinglights') },
  { title:'Levitating',          artist:'Dua Lipa',           ytId:'TUVcZfQe-Kw', duration:203, genre:'pop',      mood:'happy',    tempo:103, energy:0.82, valence:0.83, danceability:0.92, acousticness:0.0,  tags:['english','pop','dance'],      coverUrl:cov('levitating')     },
  { title:'As It Was',           artist:'Harry Styles',       ytId:'H5v3kku4y6Q', duration:167, genre:'pop',      mood:'chill',    tempo:174, energy:0.73, valence:0.57, danceability:0.82, acousticness:0.0,  tags:['english','indie','pop'],      coverUrl:cov('asitwas')        },
  { title:'Flowers',             artist:'Miley Cyrus',        ytId:'G7KNmW9a75Y', duration:200, genre:'pop',      mood:'happy',    tempo:117, energy:0.67, valence:0.83, danceability:0.75, acousticness:0.19, tags:['english','empowerment','pop'],coverUrl:cov('flowers')        },
  { title:'Anti-Hero',           artist:'Taylor Swift',       ytId:'b1kbLwvqugk', duration:200, genre:'pop',      mood:'chill',    tempo:97,  energy:0.55, valence:0.52, danceability:0.74, acousticness:0.05, tags:['english','pop','midnights'],  coverUrl:cov('antihero')       },
  { title:'Cruel Summer',        artist:'Taylor Swift',       ytId:'ic8j13piAhQ', duration:178, genre:'pop',      mood:'energetic',tempo:170, energy:0.7,  valence:0.83, danceability:0.78, acousticness:0.04, tags:['english','pop','summer'],     coverUrl:cov('cruelsummer')    },
  { title:'Shape of You',        artist:'Ed Sheeran',         ytId:'JGwWNGJdvx8', duration:234, genre:'pop',      mood:'happy',    tempo:96,  energy:0.65, valence:0.93, danceability:0.83, acousticness:0.05, tags:['english','pop','dance'],      coverUrl:cov('shapeofyou')     },
  { title:'Watermelon Sugar',    artist:'Harry Styles',       ytId:'E07s5ZYygMg', duration:174, genre:'pop',      mood:'happy',    tempo:95,  energy:0.82, valence:0.91, danceability:0.85, acousticness:0.1,  tags:['english','pop','summer'],     coverUrl:cov('watermelon')     },
  { title:'Stay',                artist:'Justin Bieber',      ytId:'oxzOnPPCOhQ', duration:141, genre:'pop',      mood:'romance',  tempo:169, energy:0.59, valence:0.69, danceability:0.82, acousticness:0.08, tags:['english','love','pop'],       coverUrl:cov('stayjb')         },
  { title:'Sunflower',           artist:'Post Malone',        ytId:'ApXoWvfEYVU', duration:158, genre:'pop',      mood:'chill',    tempo:93,  energy:0.46, valence:0.74, danceability:0.77, acousticness:0.34, tags:['english','chill','spiderman'],coverUrl:cov('sunflower')      },
  { title:'Heat Waves',          artist:'Glass Animals',      ytId:'mRD0-GxqHVo', duration:238, genre:'indie',    mood:'chill',    tempo:80,  energy:0.5,  valence:0.49, danceability:0.71, acousticness:0.12, tags:['english','indie','dreamy'],   coverUrl:cov('heatwaves')      },
  { title:'Good 4 U',            artist:'Olivia Rodrigo',     ytId:'gNi_6U5Pm_o', duration:178, genre:'pop',      mood:'energetic',tempo:167, energy:0.66, valence:0.72, danceability:0.56, acousticness:0.04, tags:['english','pop','breakup'],    coverUrl:cov('good4u')         },
  { title:'Dynamite',            artist:'BTS',                ytId:'gdZLi9oWNZg', duration:199, genre:'pop',      mood:'happy',    tempo:114, energy:0.74, valence:0.95, danceability:0.74, acousticness:0.07, tags:['kpop','party','fun'],         coverUrl:cov('dynamite')       },
  { title:'Closer',              artist:'The Chainsmokers',   ytId:'PT2_F-1esPk', duration:244, genre:'electronic',mood:'happy',  tempo:95,  energy:0.69, valence:0.83, danceability:0.87, acousticness:0.04, tags:['english','edm','love'],       coverUrl:cov('closer')         },
  { title:'Uptown Funk',         artist:'Mark Ronson ft. Bruno Mars',ytId:'OPf0YbXqDm0',duration:270,genre:'pop',mood:'energetic',tempo:115,energy:0.82, valence:0.95, danceability:0.93, acousticness:0.07, tags:['english','funk','dance'],     coverUrl:cov('uptownfunk')     },
  { title:'Despacito',           artist:'Luis Fonsi',         ytId:'ktvTqknDobU', duration:229, genre:'latin',    mood:'happy',    tempo:89,  energy:0.66, valence:0.81, danceability:0.94, acousticness:0.23, tags:['spanish','latin','summer'],   coverUrl:cov('despacito')      },
  // ── English Sad/Chill ─────────────────────────────────────────────────────
  { title:'Someone Like You',    artist:'Adele',              ytId:'hLQl3WQQoQ0', duration:285, genre:'pop',      mood:'sad',      tempo:67,  energy:0.22, valence:0.13, danceability:0.32, acousticness:0.93, tags:['english','sad','breakup'],    coverUrl:cov('someonelikeyou') },
  { title:'Fix You',             artist:'Coldplay',           ytId:'k4V3Mo61fJM', duration:295, genre:'rock',     mood:'sad',      tempo:69,  energy:0.28, valence:0.26, danceability:0.34, acousticness:0.59, tags:['english','emotional','hope'],  coverUrl:cov('fixyou')         },
  { title:'The Night We Met',    artist:'Lord Huron',         ytId:'KtlgYxa6BMU', duration:193, genre:'indie',    mood:'sad',      tempo:113, energy:0.2,  valence:0.2,  danceability:0.34, acousticness:0.68, tags:['english','sad','nostalgic'],   coverUrl:cov('nightwemet')     },
  { title:'Stressed Out',        artist:'Twenty One Pilots',  ytId:'pXRviuL6vMY', duration:202, genre:'indie',    mood:'sad',      tempo:169, energy:0.65, valence:0.39, danceability:0.74, acousticness:0.09, tags:['english','indie','emotional'], coverUrl:cov('stressedout')    },
  { title:'Bad Guy',             artist:'Billie Eilish',      ytId:'DyDfgMOUjCI', duration:194, genre:'pop',      mood:'chill',    tempo:135, energy:0.4,  valence:0.56, danceability:0.7,  acousticness:0.07, tags:['english','dark','indie'],      coverUrl:cov('badguy')         },
  // ── English Gym/Hype ──────────────────────────────────────────────────────
  { title:'Believer',            artist:'Imagine Dragons',    ytId:'7wtfhZwyrcc', duration:204, genre:'rock',     mood:'gym',      tempo:125, energy:0.85, valence:0.6,  danceability:0.7,  acousticness:0.1,  tags:['english','rock','motivation'], coverUrl:cov('believer')       },
  { title:'Thunderstruck',       artist:"AC/DC",              ytId:'v2AC41dglnM', duration:292, genre:'rock',     mood:'gym',      tempo:133, energy:0.96, valence:0.65, danceability:0.5,  acousticness:0.03, tags:['rock','gym','classic'],        coverUrl:cov('thunderstruck')  },
  { title:'Eye of the Tiger',    artist:'Survivor',           ytId:'btPJPFnesV4', duration:244, genre:'rock',     mood:'gym',      tempo:109, energy:0.87, valence:0.7,  danceability:0.58, acousticness:0.04, tags:['rock','motivation','classic'], coverUrl:cov('eyeofthetiger')  },
  { title:'Starboy',             artist:'The Weeknd',         ytId:'CvBfHwUxHIY', duration:230, genre:'rnb',      mood:'chill',    tempo:186, energy:0.59, valence:0.49, danceability:0.76, acousticness:0.08, tags:['english','rnb','night'],       coverUrl:cov('starboy')        },
  { title:'SICKO MODE',          artist:'Travis Scott',       ytId:'6ONRf7h3Mdk', duration:312, genre:'hiphop',   mood:'energetic',tempo:155, energy:0.73, valence:0.39, danceability:0.75, acousticness:0.02, tags:['rap','hiphop','trap'],         coverUrl:cov('sickomode')      },
  { title:'God Is a Woman',      artist:'Ariana Grande',      ytId:'kHLHSlExFis', duration:197, genre:'pop',      mood:'energetic',tempo:111, energy:0.62, valence:0.61, danceability:0.76, acousticness:0.22, tags:['english','pop','powerful'],    coverUrl:cov('godisaw')        },
  { title:'Without Me',          artist:'Eminem',             ytId:'YVkUvmDQ3HY', duration:290, genre:'hiphop',   mood:'energetic',tempo:99,  energy:0.72, valence:0.57, danceability:0.78, acousticness:0.03, tags:['rap','classic','hiphop'],      coverUrl:cov('withoutme')      },
  { title:'Unholy',              artist:'Sam Smith',          ytId:'Uq9gPaIzbe8', duration:157, genre:'pop',      mood:'energetic',tempo:131, energy:0.57, valence:0.56, danceability:0.76, acousticness:0.03, tags:['english','dark','pop'],        coverUrl:cov('unholy')         },
  { title:'Shake It Off',        artist:'Taylor Swift',       ytId:'nfWlot6h_JM', duration:219, genre:'pop',      mood:'happy',    tempo:160, energy:0.8,  valence:0.96, danceability:0.65, acousticness:0.09, tags:['english','pop','fun'],         coverUrl:cov('shakeitoff')     },
  { title:'Peaches',             artist:'Justin Bieber',      ytId:'tQ0yjYMFYko', duration:198, genre:'rnb',      mood:'chill',    tempo:90,  energy:0.52, valence:0.75, danceability:0.74, acousticness:0.15, tags:['english','rnb','chill'],       coverUrl:cov('peaches')        },
]

async function seed() {
  await connectDB()
  console.log('\n🌱 Starting MelodAI seed v3 (YouTube-backed)...\n')

  await Song.deleteMany({})
  await Playlist.deleteMany({})

  // Upsert admin
  let admin = await User.findOne({ email: 'admin@melodai.com' })
  if (!admin) {
    admin = await User.create({
      username: 'admin',
      email:    'admin@melodai.com',
      password: 'admin123',
      role:     'admin',
      avatar:   'https://picsum.photos/seed/admin/200/200',
    })
    console.log('✅ Admin created: admin@melodai.com / admin123')
  } else {
    console.log('ℹ️  Admin already exists')
  }

  // Upsert test user
  let testUser = await User.findOne({ email: 'test@melodai.com' })
  if (!testUser) {
    testUser = await User.create({
      username: 'testuser',
      email:    'test@melodai.com',
      password: 'test123',
      avatar:   'https://picsum.photos/seed/testuser/200/200',
    })
    console.log('✅ Test user: test@melodai.com / test123')
  } else {
    console.log('ℹ️  Test user already exists')
  }

  // Build audio URLs pointing to local YouTube stream endpoint
  const songDocs = SONGS.map((s, i) => ({
    ...s,
    audioUrl:    yt(s.ytId),         // streams via backend yt-dlp
    isYouTube:   true,
    ytId:        s.ytId,
    uploadedBy:  admin._id,
    isPublic:    true,
    plays:       Math.floor(Math.random() * 50000) + 2000,
    likes:       Math.floor(Math.random() * 10000) + 200,
    completions: Math.floor(Math.random() * 8000)  + 100,
    releaseYear: 2022 + (i % 3),
    engagementScore: Math.random() * 5 + 1,
  }))

  const songs = await Song.insertMany(songDocs)
  console.log(`\n✅ Seeded ${songs.length} songs (all YouTube-backed)\n`)

  // Create playlists
  const by = (filter) => songs.filter(filter).map(s => s._id)

  const playlists = [
    {
      name:        '🎵 Bollywood & Punjabi Hits',
      description: 'Desi banger mix — Arijit, AP Dhillon, Diljit and more',
      songs:       by(s => ['bollywood','punjabi'].includes(s.genre)).slice(0, 15),
      coverUrl:    cov('bollywood-pl'),
    },
    {
      name:        '🌍 English Bangers',
      description: 'Top English songs your whole friend group knows',
      songs:       by(s => !['bollywood','punjabi'].includes(s.genre) && s.mood !== 'sad').slice(0, 15),
      coverUrl:    cov('english-pl'),
    },
    {
      name:        '💔 Sad Hours',
      description: 'When you need to feel it all — Hindi & English',
      songs:       by(s => s.mood === 'sad').slice(0, 12),
      coverUrl:    cov('sad-pl'),
    },
    {
      name:        '🎉 Party Starter',
      description: 'Turn up. Full energy. No skips.',
      songs:       by(s => ['happy','energetic'].includes(s.mood)).slice(0, 15),
      coverUrl:    cov('party-pl'),
    },
    {
      name:        '💪 Gym Mode',
      description: 'Heavy hitters for heavy lifters',
      songs:       by(s => s.mood === 'gym').slice(0, 10),
      coverUrl:    cov('gym-pl'),
    },
  ]

  for (const pl of playlists) {
    await Playlist.create({ ...pl, owner: testUser._id, isPublic: true })
  }
  console.log(`✅ Created ${playlists.length} playlists\n`)

  await User.findByIdAndUpdate(testUser._id, {
    likedSongs:  songs.slice(0, 10).map(s => s._id),
    currentMood: 'happy',
  })

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ Seed complete!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Songs:     ${songs.length} (all YouTube-backed)`)
  console.log(`  Playlists: ${playlists.length}`)
  console.log('  Admin:     admin@melodai.com / admin123')
  console.log('  User:      test@melodai.com  / test123')
  console.log('\n  ⚠️  NOTE: YouTube songs need yt-dlp installed.')
  console.log('  If songs don\'t play, run: pip install yt-dlp')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  process.exit(0)
}

seed().catch(err => {
  console.error('\n❌ Seed failed:', err.message)
  process.exit(1)
})