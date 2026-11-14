// Rules shared by the HTTP routes and the room. No Workers APIs here, so the tests run this file directly under
// `node --test`. Carried over from Pixel Plaza: the same avatar parts, the same password scheme, the same word filter.

import { isEnglishVoice } from '../shared/voices.ts';
import { localHarm } from '../shared/safety.ts';
import type { Look } from '../shared/protocol.ts';

// One index per part. Counts come from public/cup/avatar-parts.js, the same numbers as PinPlay's ARENA_AVATAR_PARTS.
export const AVATAR_PARTS = { head: 17, skin: 20, hairColor: 25, hair: 29, eyes: 37, mouth: 41, glasses: 17, shirt: 28, hat: 29 };

export function sanitizeAvatar(value: unknown): Look | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const avatar = {} as Record<keyof typeof AVATAR_PARTS, number> & { voice?: string };
    for (const [part, count] of Object.entries(AVATAR_PARTS) as [keyof typeof AVATAR_PARTS, number][]) {
        const index = (value as Record<string, unknown>)[part] ?? 0;
        if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= count) return null;
        avatar[part] = index;
    }
    const voice = (value as Record<string, unknown>).voice;
    if (voice !== undefined) {
        if (!isEnglishVoice(voice)) return null;
        avatar.voice = voice;
    }
    return avatar;
}

export const defaultAvatar = (): Look => sanitizeAvatar({}) as Look;

// Swearing; slurs are in shared/safety.ts, which also catches them misspelt.
const blockedWords = new Set(['fuck', 'shit', 'bitch', 'cunt']);
const blockedPhrases = [/\bnobody likes you\b/i, /\bkill yourself\b/i, /\byou are stupid\b/i];
export const CHAT_MAX = 240;

export function chatProblem(value: unknown, max = CHAT_MAX): string | null {
    if (typeof value !== 'string') return 'Enter a text message.';
    const text = value.trim();
    if (!text || text.length > max) return `Messages must be 1–${max} characters.`;
    if (Array.from(text).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
        return 'Control characters are not allowed.';
    }
    const words = text.toLowerCase().match(/[\p{L}]+/gu) || [];
    if (words.some(word => blockedWords.has(word)) || blockedPhrases.some(pattern => pattern.test(text)) || localHarm(text)) {
        return 'That message cannot be sent. Please rewrite it.';
    }
    return null;
}

// The teacher laptop's address as students reach it on the school network.
// Only an http(s) origin is kept, so nothing else rides along in the redirect.
export function laptopOrigin(value: unknown): string | null {
    if (typeof value !== 'string' || value.length > 200) return null;
    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
        return url.origin;
    } catch {
        return null;
    }
}

// Constant-time for equal lengths; the length itself is not secret here.
export function secretsMatch(actual: unknown, expected: string): boolean {
    if (typeof actual !== 'string' || !expected || actual.length !== expected.length) return false;
    let difference = 0;
    for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
    return difference === 0;
}

// Same scheme as PinPlay's CREATE_PASSWORD_HASH, so it can be the same password.
export async function sha256Hex(input: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function teacherPasswordMatches(password: unknown, hash: string | undefined): Promise<boolean> {
    const expected = (hash || '').trim().toLowerCase();
    if (!expected || typeof password !== 'string') return false;
    return secretsMatch(await sha256Hex(password.trim().normalize('NFC')), expected);
}

// How many tables, and how big, for this many students: as close to the wanted size as the game allows, and nobody
// alone. An empty list means there are too few students to play.
export function tableSizes(students: number, want: number, min: number, max: number): number[] {
    if (students < min) return [];
    const size = Math.min(Math.max(want, min), max);
    let tables = Math.max(1, Math.round(students / size));
    while (students / tables > max) tables += 1;
    while (tables > 1 && Math.floor(students / tables) < min) tables -= 1;
    return Array.from({ length: tables }, (_, index) => Math.floor(students / tables) + (index < students % tables ? 1 : 0));
}

// Seats the students at tables of these sizes, trying a few shuffles and keeping the one where the fewest pairs have
// already sat together: a new round means new partners.
export function seatStudents(students: readonly string[], sizes: readonly number[], met: Readonly<Record<string, string[]>>, rnd: () => number = Math.random): string[][] {
    let best: string[][] = [];
    let bestScore = Infinity;
    for (let attempt = 0; attempt < 40 && bestScore > 0; attempt++) {
        const order = [...students];
        for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
        const tables: string[][] = [];
        let at = 0;
        for (const size of sizes) { tables.push(order.slice(at, at + size)); at += size; }
        let score = 0;
        for (const table of tables) for (const a of table) for (const b of table) if (a < b && (met[a] ?? []).includes(b)) score += 1;
        if (score < bestScore) { best = tables; bestScore = score; }
    }
    return best;
}
