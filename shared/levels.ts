// Levels: every star a student earns at a table fills a bar, and each full bar is a level. Stars are kept for good.
// Levels only unlock looks for the chat (a name colour, a badge, a bubble colour, a frame), never an advantage in a game.
import type { Style } from './protocol.ts';

// Each level needs a little more than the last: 8 stars for level 1, then 12, 16...
// The first unlock comes during a student's first game.
export const needFor = (level: number): number => 8 + 4 * level;

export function levelOf(xp: number): { level: number; into: number; need: number } {
    let level = 0;
    let left = Math.max(0, Math.floor(xp));
    while (left >= needFor(level)) { left -= needFor(level); level += 1; }
    return { level, into: left, need: needFor(level) };
}

// Name colours, readable on white. The first is the usual one, for everyone.
export const NAME_COLOURS = ['#3b3f5c', '#d6336c', '#7048e8', '#1c7ed6', '#0c8599', '#2f9e44', '#e8590c', '#b8860b'] as const;
export const FLAIRS = ['🌟', '📚', '⚽', '🎵', '🐱', '🐶', '🎨', '🍕', '🚀', '🌈', '🎮', '🍀', '🦄', '🐉', '👑', '🔥'] as const;
// Bubble colours for a student's own messages. The first is the usual one.
export const BUBBLES = ['#5b5bf0', '#d6336c', '#0c8599', '#2f9e44', '#e8590c', '#7048e8', '#1f2937'] as const;
// A ring around the face. The first is none.
export const FRAMES = ['transparent', '#ffb020', '#ff5a7a', '#21c08b', '#5b5bf0', '#111827'] as const;
export const BASE_REACTIONS = ['👍', '😂', '❤️', '❓'] as const;
export const EXTRA_REACTIONS = ['😮', '🎉', '🤔', '👏'] as const;

export type RewardId = 'colour' | 'flair' | 'bubble' | 'reactions' | 'frame';
export const REWARDS: { id: RewardId; level: number; name: string; icon: string }[] = [
    { id: 'colour', level: 1, name: 'Name colour', icon: '🎨' },
    { id: 'flair', level: 2, name: 'Badge', icon: '🌟' },
    { id: 'bubble', level: 3, name: 'Bubble colour', icon: '💬' },
    { id: 'reactions', level: 4, name: 'More reactions', icon: '🎉' },
    { id: 'frame', level: 5, name: 'Photo frame', icon: '🖼️' },
];
// Titles, just for fun, by level.
const TITLES = ['Newcomer', 'Talker', 'Chatterbox', 'Storyteller', 'Question Master', 'Word Wizard', 'Great Speaker', 'Chat Champion', 'Chat Hero', 'Chat Legend'];
export const titleFor = (level: number): string => TITLES[Math.min(level, TITLES.length - 1)];

export const unlocked = (reward: RewardId, level: number): boolean => level >= (REWARDS.find(item => item.id === reward)?.level ?? Infinity);
export const unlockedBetween = (from: number, to: number): string[] =>
    REWARDS.filter(item => item.level > from && item.level <= to).map(item => `${item.icon} ${item.name}`);
export const nextReward = (level: number) => REWARDS.find(item => item.level > level) ?? null;
export const reactionsFor = (level: number): string[] => [...BASE_REACTIONS, ...(unlocked('reactions', level) ? EXTRA_REACTIONS : [])];

export const DEFAULT_STYLE: Style = { colour: 0, flair: null, bubble: 0, frame: 0 };

// A chosen style, or null if it is not one or not unlocked yet at this level.
export function checkStyle(value: unknown, level: number): Style | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const given = value as Record<string, unknown>;
    const index = (raw: unknown, count: number): number | null =>
        raw === undefined || raw === null ? 0 : typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < count ? raw : null;
    const colour = index(given.colour, NAME_COLOURS.length);
    const bubble = index(given.bubble, BUBBLES.length);
    const frame = index(given.frame, FRAMES.length);
    const flair = given.flair ?? null;
    if (colour === null || bubble === null || frame === null) return null;
    if (flair !== null && (typeof flair !== 'string' || !(FLAIRS as readonly string[]).includes(flair))) return null;
    if ((colour !== 0 && !unlocked('colour', level)) || (bubble !== 0 && !unlocked('bubble', level))
        || (frame !== 0 && !unlocked('frame', level)) || (flair !== null && !unlocked('flair', level))) return null;
    return { colour, flair: flair as string | null, bubble, frame };
}

export function readStyle(saved: string | null, level: number): Style {
    try { return (saved && checkStyle(JSON.parse(saved), level)) || DEFAULT_STYLE; } catch { return DEFAULT_STYLE; }
}
