# HelloChat

The second version of Pixel Plaza: a chat game for an ESL class. There is no map, no campaign and no theme. A student is always **at a table with one to three classmates**, the table plays **one game**, and every move in every game is made by **writing to classmates in English**.

It keeps Pixel Plaza's characters (the PinPlay avatar editor), sign-in (PinPlay Google accounts and a class PIN), chat checks (English-only dictionary, word filter, optional OpenAI moderation and grammar hints), chat voices and levels.

## Why students always know what to do

The complaint about Pixel Plaza was that instructions were complicated. HelloChat is built around five rules:

1. **One line says what to do now.** A coloured bar above the board always holds one short sentence: green **YOUR MOVE** ("Ask Ben a question about food."), grey **WAIT** ("Ben has the ball…"). It changes the moment the game moves on.
2. **Three steps, once.** The first time a student meets a game, a card shows who they play with and three steps of a few words each. **❓ How to play** shows it again.
3. **Ideas to tap.** Under the chat are sentence starters for exactly this moment ("I chose … because …"). A tap puts one in the box with the gap selected. If a student whose move it is writes nothing for 15 seconds, the ideas wave.
4. **An example chat** fills an empty chat, so nobody starts from a blank page.
5. **Nothing to decide, nothing to find.** The game seats students, deals the cards, moves the turn on when someone is away, and gives a table that finishes early something new.

## The games

| | Game | Players | What students do |
| --- | --- | --- | --- |
| ⚡ | Speed Chat | 2–3 | A question and three messages each, then a new question. |
| 🏓 | Question Ping-Pong | 2–3 | Answer, then ask: every question hits the ball back. Ten hits together. |
| 🤔 | Would You Rather…? | 2–4 | Choose in secret, see the choices, say why with *because*. |
| ⚖️ | This or That? | 2–4 | The same, with everyday preferences (easier). |
| 👍 | Agree or Disagree? | 2–4 | The same, with opinions. |
| 🕵️ | Who Am I? | 2–4 | A secret animal or thing; yes/no questions find a classmate's. |
| 🪞 | Same or Different? | 2–3 | Describe a secret picture without naming it. Same picture or not? |
| 🔟 | Name 10! | 2–4 | A list race: ten things in a kitchen, one in each message. |
| 🥔 | Hot Potato | 2–4 | Ask a question to pass the potato before it goes off. Whoever catches it has at least 20 seconds. |
| 📖 | Emoji Story | 2–4 | One secret sentence from three pictures; vote for the best. |
| 🎲 | Question Trail | 2–4 | Roll, answer the square's question, take a follow-up question. |
| 🚫 | Don't Say It! | 2–4 | Describe a word without the forbidden words; the table guesses. |
| 🔍 | Spot the Difference | 2–3 | Two almost identical grids; only talking finds the differences. |
| 🧑‍🤝‍🧑 | Guess Who? | 2–4 | Twelve faces drawn with the avatar parts; ask about hair, hats, glasses. |
| 🎲 | Story Dice | 2–4 | A story written one sentence at a time, each with a picture word. |
| ⭕ | Tic-Tac-Talk | 2–4 | Take a square by writing a sentence with its word; a classmate judges it. |
| 🤥 | Spot the Lie | 2–4 | Two truths and a lie; questions, then a vote. |
| 🎒 | Pack the Bag | 2–4 | Choose three things alone, then talk until everyone chose the same three. |
| 🕵️ | Find the Spy | 3–4 | Everyone knows the place except the spy. |
| 🗺️ | Side Quests | 2–4 | Pick one of three quest cards, talk, write one answer for the table. |

The first ten are **warm-ups** (a few minutes; in a class activity everyone gets a new partner each round). The next nine are **board games**. **Side quests** are about 300 cards: 200 "Talk Together" quests from Pixel Plaza and about 100 new ones built so that nobody can finish alone, because each player holds a different secret card:

- **Split clues**: each player has half the facts ("The cat is not in the kitchen" / "kitchen, garden or bedroom").
- **Riddle swap**: each reads a riddle for the other to solve.
- **Word halves**: SUN + FLOWER.
- **Role-plays**: a customer and a shop assistant, a guest and a receptionist, with one fact to find out.
- **In common, Interview, Plan it, Top three, Make a story**: the answer is a short report.

A quest with a known answer is checked by the game. Any other is saved for the teacher (**Quest answers**, with a ☆ star worth 3). The answer box opens only after everyone at the table has written in the chat.

Every game checks what it can without AI: a question needs a question mark or a question word, a story sentence needs the picture word, a secret word cannot be typed by its holder, a reason with *because* earns more.

## In class

1. Open `/teacher`, sign in with the teacher password and press **▶ Open** next to your class (for example *4ESOB*). Each class has its own 6-digit **PIN** and link that never change: share the link once (**🔗 Copy link**, for example on Google Classroom) and it works every lesson.
2. Students open the class link (or the site, and type the PIN) and sign in with their school Google account. The first time they make a character. A student who uses another class's PIN is told that class is not open.
3. With **Free play** on (the default) they can start at once: a student taps a game, classmates see "Ana is waiting. Join!", and the table starts when enough have tapped.
4. Or **start an activity for everyone**: pick a warm-up, a board game or side quests, and press **Start**. The game seats everyone (tables of 2, 3 or 4, nobody alone). Options: level (A1, A2, B1), the topic of the questions (thirteen topics, or **My own questions**), students per table, rounds and minutes per round. At the end of a round everyone gets new partners. **Next round now**, **+1 minute** and **End activity** are in the same place.
5. **Tables** shows every table as it talks: who is there, what the game is waiting for, the last lines. Click a table to read everything, write to it as the teacher, take a message down (🗑) or end its game. **Needs you** lists students who pressed 🙋 Help, messages the safety filter stopped, and students who stay quiet while their table talks. Click a student to message them privately, pause their chat (🤐) or turn their sound off (🔇).
6. **📋 Report** builds a prompt to paste into an AI chat: what every table wrote, with totals, asking who did well, who needs help and for the class's common errors. Names are hidden by default.
7. **Close class** sends everyone out. The PIN and link stay the same for next time; characters, stars and levels are kept.

Other switches in the top bar: **Sound** (messages are read aloud in each student's character voice; headphones recommended), **Secret names** (made-up names such as *Happy Plato*; the teacher still sees real names) and **Level**.

A student who arrives late is seated with others who wait, or joins the smallest table. A student whose laptop sleeps keeps their seat for 45 seconds and comes back to the same table and chat. A table too small to go on is closed and its students are seated again.

## Stars and levels

Games give stars for communicating (an answer, a follow-up question, a reason, a found difference). Every star is one experience point, kept for good. Level 1 needs 8 stars, each level 4 more than the last. Levels open looks for the chat only: 1 a name colour, 2 a badge, 3 a bubble colour, 4 more reactions, 5 a photo frame. Students open them by clicking their level in the top bar.

Teachers can also star an individual chat message for +5 XP, once per message. With AI enabled, useful, varied contributions can earn +1 XP (at most eight awards and twelve checks per student per lesson, at least 45 seconds apart). Set `OPENAI_PARTICIPATION=0` to disable participation judging independently.

## Teacher tools

- **Blocked words**: lesson-specific words and phrases, including disguised spellings. Blocking a phrase removes matching chat messages already posted. Repeated phrases from several students prompt an offer to block or leave them alone; ordinary task vocabulary is excluded. A new lesson clears the active list and offers to reuse the previous one.
- **Student drawer**: click a student to pause chat, silence sound, edit their name or character, read their private teacher thread, and search conversations and submitted attempts across lessons. Browser-stopped drafts are labelled separately; unsent typing is not recorded. Use **Search message history** for the whole class, with older results available through pagination.
- **Teacher chat**: students can reply privately from the top bar, including while in the lounge. Help requests remain available in any language even when chat is paused.
- **Heard something?**: search device-reported playback from the last 15 minutes and silence the device.
- **Left the page** (as in Pixel Plaza): switching to another tab or app, or minimising the window, is counted for the lesson. The student list shows a pulsing **⚠️ Away 0:42** while a student is gone (also on their table's card) and **⚠️ 3×** afterwards; the student drawer says the same. The student sees a "You left the game" card, a reminder when they come back and a **⚠️ Left the page 3×** badge. Reloading the page does not count. It never shows what was opened elsewhere.
- **Commands**: Ctrl+K (Cmd+K on Mac) finds students, tables, and common controls.
- **Classes**: every class has a name, a PIN and a link that stay the same lesson after lesson. **✏️ Rename** a class at any time; **New PIN** replaces a PIN and link that went somewhere they should not (the old ones stop working). Add a class or switch classes when the class is closed: progress, student edits, histories and settings are saved automatically. One class can be open at a time; switching does not resume a live round.
- **Free language hint**: under Help, students get one AI sentence starter per lesson. Failed requests preserve the allowance. Hints require a successful safety check and never replace the teacher-help button.

## Chat checks

- **English only**: every word is checked against a dictionary in the browser (American suggestions, British spellings accepted, classmates' names and the words on the board allowed). A wrong word shows suggestions to tap. On the teacher's laptop the server checks again.
- **Word filter**: slurs, swearing and unkind phrases are stopped before anyone sees them, and the teacher is told.
- **OpenAI moderation and grammar hints** (optional): with `OPENAI_API_KEY`, every message is also checked by `omni-moderation-latest`, and a message with one clear mistake gets "Try this: …" with **OK, send this** / **Send mine**. It never blocks. Without a key the top bar says *No AI checks*.
- **What the OpenAI calls cost**: [OPENAI-FREE-TOKENS.md](OPENAI-FREE-TOKENS.md) says which are free with this account's data-sharing tokens (`gpt-4o-mini`) and which are billed (`gpt-6-luna`).
- Pasting into the chat is off.

## Where it runs

One Cloudflare Worker, `hello-chat`, beside PinPlay and Pixel Plaza.

| Piece | What it does |
| --- | --- |
| Static assets | The built app (`dist/`). |
| `worker/index.ts` | `/api/*`: student sign-in (passed to PinPlay), joining, teacher controls, speech. |
| `worker/room.ts` | The `ChatRoom` Durable Object: sockets, tables, rounds, free play, chat checks, SQLite storage. |
| `worker/games/` | The games: plain functions with no clock or dice of their own, so tests play whole games in milliseconds. |
| `worker/content/` | Questions, cards, word sets and quests. Plain data; add to it freely. |
| `shared/protocol.ts` | What the server and the page say to each other. A game sends each student a *view*: the one line, the starters, and a board made of a dozen simple pieces. |

### One-time setup

```powershell
npm ci
npm run deploy                                  # or double-click deploy.bat
npx wrangler secret put CREATE_PASSWORD_HASH    # the same hash as PinPlay's: one teacher password
npx wrangler secret put OPENAI_API_KEY          # optional
```

Add the new address (`https://hello-chat.<account>.workers.dev`, or a custom domain) to **Authorized JavaScript origins** of the Google OAuth client PinPlay uses.

### On the teacher's laptop

`classroom.bat` runs the same Worker on the laptop for the school network, as in Pixel Plaza: students sign in online (Google needs HTTPS) and are sent to the laptop. Sign in to `/teacher` on the laptop itself; that is what sends students there. `HELLOCHAT_LAN_URL` and `HELLOCHAT_CLOUD_URL` override the addresses. `.dev.vars` is git-ignored, so each computer has its own: on its first run `classroom.bat` asks for the teacher password, and when there is no `OPENAI_API_KEY` line it copies the key from a sibling project's `.dev.vars` (Pixel Plaza) or asks for it once.

### Try it alone

`tester.bat` (or `npm run build && npm run tester`) opens a throwaway class with the teacher and four made-up students, one browser tab each, no Google needed.

## Checks

```powershell
npm test                          # 80+ tests: bots play every game to its end, with every table size and level
npm run test:live                 # a real local Worker lesson, teacher controls and AI flows (local mock; no API spend)
node scripts/browser-check.mjs    # real Chrome tabs play every game; pictures land in .wrangler/shots
npm run lint
```

## Adding a game

A game is one object (`worker/games/types.ts`): `create`, `chat` (what a message means, before anyone reads it: it can count, be refused with a reason, or stay secret), `act` (a tap), `tick` (time is up), `join`, `leave` and `view` (what one student sees). Register it in `worker/games/index.ts`; the bots in `worker/tests/games.test.mjs` will play it at once. The page needs no change unless the board needs a new kind of piece (`src/components/Widgets.tsx`).

## Current limits

- Up to 30 saved classes; open one at a time.
- Without an OpenAI key, messages are checked by the dictionary and the word filter only; the teacher can take any message down.
- Games judge form, not truth: a sentence with the right word and length counts. Classmates judge the rest (Tic-Tac-Talk, Name 10!) and the teacher reads everything.
- Browser controls cannot stop screenshots or translation tools outside the page.
