require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');
const Song = require('../models/Song');
const Playlist = require('../models/Playlist');

const SAMPLE_SONGS = [
  { title: 'Neon Lights', artist: 'Aurora Synth', album: 'Cyberpulse', duration: 212, genre: 'electronic', mood: 'energetic', tempo: 128, energy: 0.9, valence: 0.8, danceability: 0.85, acousticness: 0.05, tags: ['synth', 'neon', 'dance'], audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', coverUrl: 'https://picsum.photos/seed/neon/500/500' },
  { title: 'Rainy Afternoon', artist: 'Solitude Keys', album: 'Quiet Hours', duration: 185, genre: 'indie', mood: 'sad', tempo: 72, energy: 0.25, valence: 0.2, danceability: 0.3, acousticness: 0.9, tags: ['piano', 'rain', 'melancholy'], audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', coverUrl: 'https://picsum.photos/seed/rain/500/500' },
  { title: 'Midnight Hustle', artist: 'BeatForge', album: 'Street Chronicles', duration: 198, genre: 'hiphop', mood: 'energetic', tempo: 95, energy: 0.8, valence: 0.7, danceability: 0.9, acousticness: 0.1, tags: ['rap', 'beats', 'flow'], audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', coverUrl: 'https://picsum.photos/seed/hiphop/500/500' },
  { title: 'Solar Winds', artist: 'Ambient Collective', album: 'Deep Space', duration: 320, genre: 'ambient', mood: 'focus', tempo: 60, energy: 0.2, valence: 0.5, danceability: 0.2, acousticness: 0.7, tags: ['space', 'meditation', 'focus'], audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', coverUrl: 'https://picsum.photos/seed/space/500/500' },
  { title: 'Summer Fire', artist: 'The Groove Band', album: 'Heat Wave', duration: 225, genre: 'pop', mood: 'happy', tempo: 118, energy: 0.85, valence: 0.9, danceability: 0.88, acousticness: 0.15, tags: ['summer', 'fun', 'upbeat'], audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', coverUrl: 'https://picsum.photos/seed/summer/500/500' },
  { title: 'Iron Mountain', artist: 'Steel Vortex', album: 'Riff Valley', duration: 267, genre: 'rock', mood: 'gym', tempo: 140, energy: 0.95, valence: 0.6, danceability: 0.5, acousticness: 0.05, tags: ['guitar', 'heavy', 'power'], audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', coverUrl: 'https://picsum.photos/seed/rock/500/500' },
  { title: 'Velvet Sunset', artist: 'Luna Jazz Trio', album: 'Blue Hours', duration: 245, genre: 'jazz', mood: 'romance', tempo: 85, energy: 0.4, valence: 0.65, danceability: 0.55, acousticness: 0.8, tags: ['smooth', 'evening', 'lounge'], audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', coverUrl: 'https://picsum.photos/seed/jazz/500/500' },
  { title: 'Code Runner', artist: 'Digital Monk', album: 'Lo-Fi Sessions', duration: 190, genre: 'electronic', mood: 'focus', tempo: 80, energy: 0.35, valence: 0.5, danceability: 0.55, acousticness: 0.3, tags: ['lofi', 'study', 'beats'], audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', coverUrl: 'https://picsum.photos/seed/lofi/500/500' },
  { title: 'Heartstrings', artist: 'Maya Rivers', album: 'Confessions', duration: 218, genre: 'rnb', mood: 'romance', tempo: 88, energy: 0.5, valence: 0.7, danceability: 0.65, acousticness: 0.4, tags: ['soul', 'love', 'vocals'], audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3', coverUrl: 'https://picsum.photos/seed/rnb/500/500' },
  { title: 'Gravity Pull', artist: 'Orbit Station', album: 'Weightless', duration: 298, genre: 'ambient', mood: 'chill', tempo: 70, energy: 0.3, valence: 0.45, danceability: 0.3, acousticness: 0.6, tags: ['chill', 'relax', 'float'], audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', coverUrl: 'https://picsum.photos/seed/orbit/500/500' },
  { title: 'Beast Mode', artist: 'PowerChain', album: 'Gains', duration: 201, genre: 'electronic', mood: 'gym', tempo: 150, energy: 0.98, valence: 0.75, danceability: 0.7, acousticness: 0.02, tags: ['workout', 'pump', 'intense'], audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3', coverUrl: 'https://picsum.photos/seed/gym/500/500' },
  { title: 'Forest Walk', artist: 'Acoustic Soul', album: 'Nature Diaries', duration: 240, genre: 'folk', mood: 'chill', tempo: 68, energy: 0.2, valence: 0.6, danceability: 0.3, acousticness: 0.95, tags: ['acoustic', 'nature', 'folk'], audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3', coverUrl: 'https://picsum.photos/seed/folk/500/500' },
  { title: 'City Never Sleeps', artist: 'Urban Echo', album: 'Downtown', duration: 232, genre: 'hiphop', mood: 'energetic', tempo: 100, energy: 0.75, valence: 0.65, danceability: 0.82, acousticness: 0.05, tags: ['city', 'urban', 'night'], audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', coverUrl: 'https://picsum.photos/seed/city/500/500' },
  { title: 'Moonlit Dance', artist: 'Celestial String Quartet', album: 'Nocturnes', duration: 310, genre: 'classical', mood: 'romance', tempo: 76, energy: 0.35, valence: 0.6, danceability: 0.4, acousticness: 0.98, tags: ['strings', 'classical', 'elegant'], audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', coverUrl: 'https://picsum.photos/seed/classical/500/500' },
  { title: 'Dopamine Rush', artist: 'Synaptic Fire', album: 'Brain Waves', duration: 195, genre: 'pop', mood: 'happy', tempo: 125, energy: 0.9, valence: 0.95, danceability: 0.92, acousticness: 0.08, tags: ['pop', 'happy', 'dance'], audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', coverUrl: 'https://picsum.photos/seed/dopamine/500/500' },
  { title: 'Empty Pages', artist: 'The Wanderers', album: 'Letters Never Sent', duration: 255, genre: 'indie', mood: 'sad', tempo: 78, energy: 0.3, valence: 0.2, danceability: 0.35, acousticness: 0.75, tags: ['emotional', 'indie', 'acoustic'], audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', coverUrl: 'https://picsum.photos/seed/indie/500/500' },
  { title: 'Thunder Clap', artist: 'Steel Vortex', album: 'Storm Season', duration: 235, genre: 'metal', mood: 'gym', tempo: 168, energy: 0.99, valence: 0.4, danceability: 0.4, acousticness: 0.01, tags: ['metal', 'heavy', 'loud'], audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', coverUrl: 'https://picsum.photos/seed/metal/500/500' },
  { title: 'Siesta Breeze', artist: 'Latin Soul', album: 'Caliente', duration: 210, genre: 'latin', mood: 'happy', tempo: 100, energy: 0.7, valence: 0.85, danceability: 0.9, acousticness: 0.3, tags: ['latin', 'salsa', 'tropical'], audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', coverUrl: 'https://picsum.photos/seed/latin/500/500' },
  { title: 'Deep Dive', artist: 'Digital Monk', album: 'Flow State', duration: 280, genre: 'electronic', mood: 'focus', tempo: 90, energy: 0.5, valence: 0.55, danceability: 0.6, acousticness: 0.15, tags: ['deep', 'focus', 'flow'], audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', coverUrl: 'https://picsum.photos/seed/deep/500/500' },
  { title: 'Golden Hour', artist: 'Maya Rivers', album: 'Warmth', duration: 228, genre: 'rnb', mood: 'chill', tempo: 82, energy: 0.45, valence: 0.75, danceability: 0.6, acousticness: 0.45, tags: ['golden', 'warm', 'smooth'], audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', coverUrl: 'https://picsum.photos/seed/golden/500/500' },
];

async function seed() {
  await connectDB();
  console.log('🌱 Seeding database...');

  await User.deleteMany({});
  await Song.deleteMany({});
  await Playlist.deleteMany({});

  // Create admin
  const admin = await User.create({
    username: 'admin',
    email: 'admin@melodai.com',
    password: 'admin123',
    role: 'admin',
    avatar: 'https://picsum.photos/seed/admin/200/200',
  });

  // Create test user
  const testUser = await User.create({
    username: 'testuser',
    email: 'test@melodai.com',
    password: 'test123',
    avatar: 'https://picsum.photos/seed/testuser/200/200',
  });

  // Create songs
  const songs = await Song.insertMany(
    SAMPLE_SONGS.map(s => ({ ...s, uploadedBy: admin._id, plays: Math.floor(Math.random() * 10000), likes: Math.floor(Math.random() * 2000) }))
  );

  console.log(`✅ Created ${songs.length} songs`);

  // Create playlists
  await Playlist.create([
    {
      name: 'Chill Vibes',
      description: 'Perfect for relaxing evenings',
      owner: admin._id,
      songs: songs.filter(s => s.mood === 'chill' || s.mood === 'focus').map(s => s._id),
      isPublic: true,
      coverUrl: 'https://picsum.photos/seed/chill/500/500',
    },
    {
      name: 'Gym Beasts',
      description: 'Maximum energy for your workout',
      owner: admin._id,
      songs: songs.filter(s => s.mood === 'gym' || s.energy > 0.85).map(s => s._id),
      isPublic: true,
      coverUrl: 'https://picsum.photos/seed/beast/500/500',
    },
    {
      name: 'Late Night Jazz',
      description: 'Smooth sounds for the night owl',
      owner: admin._id,
      songs: songs.filter(s => s.genre === 'jazz' || s.genre === 'rnb').map(s => s._id),
      isPublic: true,
      coverUrl: 'https://picsum.photos/seed/night/500/500',
    },
  ]);

  console.log('✅ Created sample playlists');
  console.log('\n👤 Admin: admin@melodai.com / admin123');
  console.log('👤 User:  test@melodai.com / test123');
  console.log('\n✅ Seed complete!');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
