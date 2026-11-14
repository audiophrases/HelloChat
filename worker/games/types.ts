// A game is plain data and plain functions: no Workers APIs, no clock and no dice of its own. The room hands it the
// time, the dice and who is at the table, so the tests can play a whole game in a few milliseconds.
import type { Kind, Level, View } from '../../shared/protocol.ts';

export type Player = { key: string; name: string };

export type Opts = {
    level: Level;
    topic: string;            // a question deck id, or 'mix'
    custom: string[];         // the teacher's own questions
    endless: boolean;         // a timed class round: the game deals more cards instead of ending
};

export type Ctx = {
    now: number;
    rnd: () => number;        // [0, 1)
    players: Player[];        // who is at the table now, in seat order
    opts: Opts;
};

// What the game says in the table's chat, in its own voice. `to` makes it a private line.
export type Say = { text: string; to?: string; tone?: 'info' | 'good' | 'bad' };
export type Fx = { to?: string; kind: 'good' | 'bad' | 'win' | 'boom' | 'star' | 'turn' };
export type Out = { say?: Say[]; fx?: Fx[]; report?: { quest: string; title: string; text: string; by: string } };

// What a game makes of a chat message, before anyone else reads it.
export type Verdict = Out & {
    block?: string;           // not sent: the reason, shown to the writer, whose words stay in the box
    secret?: boolean;         // kept from the others for now (a hidden answer)
};

// Every game's state starts with these.
export type Base = {
    stars: Record<string, number>;
    due: number | null;       // when the room must call tick()
    over: boolean;
};

export interface Game<S extends Base = any> {
    id: string;
    kind: Kind;
    title: string;
    icon: string;
    blurb: string;            // one line for the menu
    min: number; max: number; ideal: number;
    minutes: number;
    levels: Level[];
    how: [string, string, string];   // three short steps, shown once
    example: string[];               // a sample chat, alternating speakers
    create(ctx: Ctx): S;
    chat(s: S, ctx: Ctx, from: string, text: string): Verdict;
    act(s: S, ctx: Ctx, from: string, act: string, data: unknown): Out;
    tick(s: S, ctx: Ctx): Out;
    join(s: S, ctx: Ctx, key: string): Out;    // ctx.players already has them
    leave(s: S, ctx: Ctx, key: string): Out;   // ctx.players no longer has them
    view(s: S, ctx: Ctx, me: string): View;
    status(s: S, ctx: Ctx): string;            // one line for the teacher
}
