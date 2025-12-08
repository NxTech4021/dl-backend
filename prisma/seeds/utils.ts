/**
 * Shared utilities for database seeding
 */

import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

// =============================================
// DATE UTILITIES
// =============================================

/**
 * Generate a random date between start and end
 */
export function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/**
 * Get a date N days ago from now
 */
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Get a date N days from now
 */
export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/**
 * Get a date N months ago from now
 */
export function monthsAgo(months: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

// =============================================
// RANDOM UTILITIES
// =============================================

/**
 * Get a random element from an array
 */
export function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Get multiple random elements from an array (no duplicates)
 */
export function randomElements<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, arr.length));
}

/**
 * Get a random integer between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get a random decimal between min and max
 */
export function randomDecimal(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

/**
 * Random boolean with optional probability
 */
export function randomBoolean(probability: number = 0.5): boolean {
  return Math.random() < probability;
}

/**
 * Weighted random selection
 */
export function weightedRandom<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i]!;
    if (random <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

// =============================================
// DATA CONSTANTS
// =============================================

export const MALAYSIAN_FIRST_NAMES = {
  male: [
    "Ahmad", "Mohammad", "Muhammad", "Azman", "Hafiz", "Faizal", "Rizal", "Khairul",
    "Shahrul", "Amirul", "Hakim", "Irfan", "Nazri", "Syafiq", "Zulkifli", "Danial",
    "Farhan", "Hafizul", "Iskandar", "Jazlan", "Kumar", "Lim", "Tan", "Wong", "Lee",
    "Chen", "Ng", "Ong", "Raj", "Siva", "Arif", "Azhar", "Badrul", "Danish", "Ezra",
    "Firdaus", "Ghani", "Haziq", "Imran", "Jamal", "Kamal", "Lokman", "Malik", "Nabil",
    "Omar", "Putra", "Qadir", "Rafiq", "Saiful", "Tariq", "Umar", "Wafi", "Yasin", "Zahir",
    "Aidil", "Bakri", "Chong", "Derek", "Edwin", "Felix", "Gerald", "Henry", "Ivan", "James"
  ],
  female: [
    "Nurul", "Siti", "Nur", "Aisyah", "Fatimah", "Aminah", "Farah", "Sarah", "Hana",
    "Nadia", "Zahra", "Iman", "Alya", "Syafiqah", "Amalina", "Balqis", "Camelia",
    "Dania", "Elina", "Fatin", "May", "Mei", "Ling", "Jia", "Hui", "Priya", "Kavitha",
    "Lakshmi", "Deepa", "Anitha", "Aina", "Batrisyia", "Dahlia", "Emma", "Fiqa",
    "Ghazalina", "Hamizah", "Intan", "Jasmin", "Khairunnisa", "Layla", "Maisara",
    "Nabila", "Qistina", "Rabiatul", "Sofea", "Tasha", "Wardina", "Yasmin", "Zara",
    "Amanda", "Beatrice", "Crystal", "Diana", "Emily", "Felicia", "Grace", "Hannah"
  ],
};

export const MALAYSIAN_LAST_NAMES = [
  "Abdullah", "Rahman", "Ibrahim", "Hassan", "Ismail", "Omar", "Ahmad", "Ali",
  "Yusof", "Aziz", "Hamid", "Karim", "Rashid", "Malik", "Tan", "Lim", "Wong",
  "Lee", "Chen", "Ng", "Kumar", "Rajan", "Pillai", "Nair", "Menon", "Bakar",
  "Othman", "Jaafar", "Sulaiman", "Zainal", "Mokhtar", "Salleh", "Hashim",
  "Latif", "Ghani", "Rahim", "Samad", "Mansor", "Yusuf", "Osman", "Noordin"
];

export const AREAS = [
  "Kuala Lumpur", "Petaling Jaya", "Subang Jaya", "Shah Alam", "Bangsar",
  "Mont Kiara", "Damansara", "Ampang", "Cheras", "Puchong", "Cyberjaya",
  "Putrajaya", "Klang", "Kajang", "Seremban", "Johor Bahru", "Penang",
  "Ipoh", "Melaka", "Kota Kinabalu", "Kuching", "Bukit Jalil", "TTDI",
  "Desa ParkCity", "Setia Alam", "Sunway", "USJ", "Ara Damansara"
];

export const BIOS = [
  "Love playing doubles! Looking for partners.",
  "Intermediate player, play for fun.",
  "Advanced player, competitive mindset.",
  "Beginner looking to improve!",
  "Experienced doubles player.",
  "Weekend warrior, love the game!",
  "Competitive player, looking for tournaments.",
  "Doubles specialist, team player.",
  "Improving steadily every week.",
  "Advanced singles and doubles player.",
  "Tennis enthusiast turned pickleball fanatic.",
  "Padel lover from Spain.",
  "New to the game but learning fast!",
  "Competitive spirit runs in my veins!",
  "Weekend player, weekday warrior.",
  "Love the thrill of competition!",
  "All-around player, any game works.",
  "Doubles is life!",
  "Playing for fun and fitness!",
  "Former tennis pro, new to pickleball.",
  "Here for the community and the game.",
  "Looking to improve my ratings!",
  "Serious about the sport, friendly on court.",
  "Ready for any challenge!",
  "Making friends through sports.",
  "Three-time division champion!",
  "Just started playing this year.",
  "Retired athlete enjoying racket sports.",
  "Sports enthusiast and family man.",
  "Work hard, play harder!",
];

export const VENUES = [
  "Subang Sports Center", "KL Arena", "PJ Stadium", "Selangor Courts",
  "Bangsar Sports Complex", "Mont Kiara Recreation Club", "Damansara Heights Club",
  "Ampang Point Sports", "Cheras Leisure Mall Courts", "Puchong Sports Hub",
  "Cyberjaya Recreation Center", "Putrajaya Sports Complex", "Shah Alam Stadium",
  "Sunway Pyramid Courts", "1 Utama Sports Zone", "Mid Valley Sports Center",
  "KLCC Convention Center Courts", "Bukit Jalil National Sports Complex",
  "National Sports Council", "Royal Selangor Club", "Lake Club KL"
];

export const COURT_NAMES = [
  "Court 1", "Court 2", "Court 3", "Court 4", "Court 5", "Court 6",
  "Court A", "Court B", "Court C", "Court D", "Center Court", "Main Court",
  "Indoor Court 1", "Indoor Court 2", "Outdoor Court 1", "Outdoor Court 2"
];

// =============================================
// LOGGING UTILITIES
// =============================================

export function logProgress(message: string): void {
  console.log(`   ${message}`);
}

export function logSection(title: string): void {
  console.log(`\n${title}`);
}

export function logSuccess(message: string): void {
  console.log(`   ✅ ${message}`);
}

export function logWarning(message: string): void {
  console.log(`   ⚠️ ${message}`);
}

// =============================================
// BATCH PROCESSING
// =============================================

/**
 * Process items in batches to avoid memory issues
 */
export async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Create many records with progress logging
 */
export async function createManyWithProgress<T>(
  name: string,
  total: number,
  creator: (index: number) => Promise<T>
): Promise<T[]> {
  const results: T[] = [];
  const logInterval = Math.max(1, Math.floor(total / 10));

  for (let i = 0; i < total; i++) {
    const result = await creator(i);
    results.push(result);

    if ((i + 1) % logInterval === 0 || i === total - 1) {
      logProgress(`${name}: ${i + 1}/${total} created`);
    }
  }

  return results;
}
