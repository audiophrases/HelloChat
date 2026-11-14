// What the server and the page say to each other. Plain types, no imports from either side.
// One idea runs through all of it: a student is always at a TABLE with one to three classmates, the table plays one
// GAME, and the game tells each student, in one short sentence, what to do NOW.

export type Level = 'A1' | 'A2' | 'B1';
export const LEVELS: Level[] = ['A1', 'A2', 'B1'];
export type Kind = 'warmup' | 'board' | 'quest';

// The parts of an avatar, as PinPlay numbers them.
export type Look = { head?: number; skin: number; hairColor: number; hair: number; eyes: number; mouth: number; glasses: number; shirt: number; hat: number; voice?: string };

// What a student chose with their levels: a name colour, a badge before the name, a bubble colour and a frame.
export type Style = { colour: number; flair: string | null; bubble: number; frame: number };

// ---------- The board: a few simple pieces every game is drawn with ----------

export type Cell = {
    id: string; emoji?: string; label?: string; sub?: string;
    state?: 'free' | 'mine' | 'taken' | 'found' | 'wrong' | 'out' | 'hot';
    owner?: string;      // a student key: their face is drawn on the cell
    look?: Look;         // a made-up person (Guess Who?)
    off?: boolean;       // cannot be tapped
};

export type Option = { id: string; emoji?: string; label: string; sub?: string; picked?: boolean; by?: string[]; state?: 'right' | 'wrong'; face?: string; off?: boolean };

export type Widget =
    // One card: a question, a secret word, a task.
    | { w: 'card'; emoji?: string; label?: string; title: string; text?: string; tone?: 'plain' | 'secret' | 'good' | 'bad'; banned?: string[]; chips?: string[] }
    // Big buttons to choose from: A or B, a vote, yes or no.
    | { w: 'options'; act: string; options: Option[]; cols?: number; off?: boolean; label?: string }
    // A grid of squares: pictures to compare, people to guess, squares to win.
    | { w: 'grid'; cols: number; cells: Cell[]; act?: string; coords?: boolean; label?: string; cross?: boolean }
    // A path with everyone's token on it, and a die.
    | { w: 'path'; squares: { emoji: string; kind: string }[]; tokens: { key: string; at: number }[]; die: number | null }
    // A story growing line by line, with the picture dice to use.
    | { w: 'story'; lines: { by?: string; text: string }[]; dice?: { emoji: string; word: string; state: 'done' | 'now' | 'next' }[]; label?: string }
    // A ball going from player to player.
    | { w: 'rally'; hits: number; goal: number; best: number; holder: string; order: string[] }
    // Things the table has collected.
    | { w: 'items'; label?: string; items: { id: string; text: string; by?: string; ask?: boolean }[]; goal: number; act?: string }
    // Hearts, questions left, a score.
    | { w: 'meter'; label: string; value: number; max: number; icon: string }
    // The potato and who holds it.
    | { w: 'bomb'; holder: string; lives: Record<string, number>; boom?: boolean }
    // A box for the table's written answer.
    | { w: 'answer'; act: string; label: string; placeholder: string; min: number; max: number; hint?: string }
    // Numbered sentences (two truths and a lie).
    | { w: 'sentences'; items: { id: string; text: string; state?: 'lie' | 'true'; by?: string[] }[]; act?: string; off?: boolean; label?: string };

// One student's view of their table's game.
export type View = {
    // The one thing to do now. 'go' means you act; 'wait' means someone else does; 'done' means the game is over.
    now: { tone: 'go' | 'wait' | 'done'; text: string; sub?: string };
    starters?: string[];                                   // sentence beginnings: a tap puts one in the chat box
    actions?: { act: string; label: string; data?: unknown; ghost?: boolean }[];
    chat: { hint?: string; secret?: boolean };            // secret: what you write now stays hidden until it is shown
    board: Widget[];
    timer?: { ends: number; total: number } | null;
    seats: { key: string; stars: number; turn?: boolean; tag?: string }[];
    round?: { n: number; of: number };
    over?: { title: string; lines: string[] } | null;
};

export type Member = { key: string; name: string; look: Look; style: Style; here: boolean };

export type Line = {
    id: string; ts: number;
    from: string;             // a student key, 'sys' for the game's own voice, 'teacher'
    name: string;
    text: string;
    tone?: 'info' | 'good' | 'bad';
    secret?: boolean;         // only you see it for now
    marks?: [number, number][];
    voice?: string;
    reacts?: Record<string, string[]>; // emoji -> student keys
};

export type GameInfo = { id: string; kind: Kind; title: string; icon: string; blurb: string; min: number; max: number; minutes: number; how: string[]; example: string[]; levels: Level[] };

export type TableInfo = {
    id: string; game: GameInfo; members: Member[]; lines: Line[]; view: View;
    free: boolean;                                         // free play: the table can leave or play again
    session?: { round: number; rounds: number; ends: number | null } | null;
};

export type LoungeInfo = {
    open: boolean;
    free: boolean;                                         // students choose their own games
    games: GameInfo[];
    waiting: Record<string, string[]>;                     // game id -> names of classmates waiting to play it
    queued: string | null;                                 // the game this student waits for
    session: { title: string; icon: string; note: string } | null; // a class activity is running and a partner is being found
    online: number;
};

export type Me = { key: string; name: string; look: Look; style: Style; xp: number };

export type ServerMessage =
    | { t: 'welcome'; me: Me; names: string[]; soundOff: boolean; muted: boolean; hints: boolean }
    | { t: 'lounge'; lounge: LoungeInfo }
    | { t: 'table'; table: TableInfo | null; why?: string }
    | { t: 'view'; id: string; view: View }
    | { t: 'members'; id: string; members: Member[] }
    | { t: 'line'; id: string; line: Line }
    | { t: 'retract'; id: string; line: string }
    | { t: 'react'; id: string; line: string; reacts: Record<string, string[]> }
    | { t: 'typing'; id: string; key: string }
    | { t: 'sent'; cid: string; line?: Line }                        // your message went through
    | { t: 'refused'; cid: string; text: string; keep: boolean }     // it did not; keep: the words go back in the box
    | { t: 'checked'; id: string; ok: boolean; corrected?: string; why?: string }
    | { t: 'notice'; level: 'info' | 'warning' | 'teacher'; text: string }
    | { t: 'fx'; kind: 'good' | 'bad' | 'win' | 'boom' | 'star' | 'turn' }
    | { t: 'xp'; xp: number; gained?: number; reason?: string }
    | { t: 'me'; me: Me }
    | { t: 'sound'; off: boolean }
    | { t: 'muted'; muted: boolean }
    | { t: 'names'; names: string[] }
    | { t: 'bye'; why: 'replaced' | 'closed' };   // sent just before the server closes the connection

export type ClientMessage =
    | { t: 'chat'; text: string; cid: string; was?: string; better?: string }
    | { t: 'check'; id: string; text: string }
    | { t: 'act'; act: string; data?: unknown }
    | { t: 'typing' }
    | { t: 'queue'; game: string | null }
    | { t: 'leave' }
    | { t: 'again' }
    | { t: 'react'; line: string; emoji: string }
    | { t: 'help'; note: string }
    | { t: 'style'; style: Style };

// ---------- What the teacher's page reads ----------

export type TeacherTable = {
    id: string; game: string; icon: string; title: string; kind: Kind;
    members: { key: string; name: string; here: boolean; stars: number; messages: number }[];
    status: string;          // "Ana is answering", "Voting"
    messages: number; lastTs: number; over: boolean;
    last: { name: string; text: string; from: string }[];
};

export type TeacherStudent = {
    key: string; name: string; real: string; look: Look; online: boolean; table: string | null;
    messages: number; words: number; stars: number; xp: number; muted: boolean; soundOff: boolean; lastTs: number; blocked: number;
};

export type TeacherAlert = { id: string; kind: 'help' | 'incident' | 'quiet'; key: string; name: string; text: string; ts: number; count?: number };

export type TeacherReport = { id: string; ts: number; quest: string; names: string[]; text: string; starred: boolean; table: string };

export type TeacherStatus = {
    open: boolean; pin: string | null; free: boolean; soundOff: boolean; secretNames: boolean; level: Level; ai: boolean;
    games: GameInfo[]; topics: { id: string; title: string; emoji: string }[];
    session: { id: string; game: string; title: string; icon: string; round: number; rounds: number; ends: number | null; started: number } | null;
    students: TeacherStudent[]; tables: TeacherTable[]; alerts: TeacherAlert[]; reports: TeacherReport[];
    waiting: string[];       // names of students with no table yet
    custom: string;          // the teacher's own questions, one per line
    laptop?: { url: string; signInUrl: string } | null; notice?: string;
};

export type StartOptions = { game: string; level: Level; size: number; rounds: number; minutes: number; topic: string };
