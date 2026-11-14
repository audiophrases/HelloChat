// Every game the class can play, in the order the menu shows them.
import type { GameInfo } from '../../shared/protocol.ts';
import { agree, thisorthat, wouldyourather } from './choose.ts';
import { spotdiff, tictac } from './grids.ts';
import { packbag, spy } from './group.ts';
import { guesswho, samediff, whoami } from './guess.ts';
import { quest } from './quest.ts';
import { spotlie, storydice } from './story.ts';
import { hotpotato, pingpong, speedchat } from './talk.ts';
import { trail } from './trail.ts';
import type { Game } from './types.ts';
import { dontsayit, emojistory, name10 } from './wordgames.ts';

export const GAMES: Game[] = [
    // Warm-ups: three to five minutes, new partners every round.
    speedchat, pingpong, wouldyourather, thisorthat, agree, whoami, samediff, name10, hotpotato, emojistory,
    // Board games: ten minutes or so at one table.
    trail, dontsayit, spotdiff, guesswho, storydice, tictac, spotlie, packbag, spy,
    // Quests.
    quest,
];

export const gameById = (id: string): Game | undefined => GAMES.find(game => game.id === id);

export const info = (game: Game): GameInfo => ({
    id: game.id, kind: game.kind, title: game.title, icon: game.icon, blurb: game.blurb, min: game.min, max: game.max, minutes: game.minutes,
    how: [...game.how], example: [...game.example], levels: [...game.levels],
});
