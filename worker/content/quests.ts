// Side quests: short tasks a table solves by talking. Two hundred "Talk Together" quests come from Pixel Plaza;
// the rest are new for HelloChat and are built so that nobody can finish alone: each player gets a different secret
// card (half the clues, half a word, one side of a role-play), and the answer needs both.
import type { Level } from '../../shared/protocol.ts';
import talk200 from './talk200.json' with { type: 'json' };

export type Quest = {
    id: string; title: string; level: Level; size: 'pair' | 'group' | 'any'; minutes: number; cat: string; emoji: string;
    text: string;
    roles?: string[];         // secret cards, dealt so that every card is held by someone
    accept?: string[][];      // a right answer says one word from every group; without it, the answer is a short report
    hint?: string;
};

let count = 0;
const id = (prefix: string) => `${prefix}${++count}`;

// ---------- Split clues: each player holds half of the facts ----------
const clue = (level: Level, title: string, question: string, a: string, b: string, accept: string[][], hint?: string): Quest => ({
    id: id('clue'), title, level, size: 'any', minutes: 3, cat: 'Split clues', emoji: '🧩',
    text: `You each have a secret clue card. Tell each other your clues, then answer together: ${question}`,
    roles: [`Your clues: ${a}`, `Your clues: ${b}`], accept, hint,
});

const CLUES: Quest[] = [
    clue('A1', 'The Lost Cat', 'Where is the cat?', 'The cat is not in the kitchen. The cat is not in the garden.', 'The cat is in the kitchen, the garden or the bedroom.', [['bedroom']]),
    clue('A1', 'Tom’s Birthday', 'Which month is Tom’s birthday?', 'Tom’s birthday is in summer: June, July or August.', 'Tom’s birthday is not in June. It is not in August.', [['july']]),
    clue('A1', 'Mia’s Pet', 'What is Mia’s pet?', 'Mia’s pet has four legs.', 'Mia’s pet is a fish, a bird or a dog.', [['dog']]),
    clue('A1', 'Sam’s Lunch', 'What does Sam eat today?', 'Sam doesn’t eat meat. Sam doesn’t eat fish.', 'Today’s menu: chicken and rice, fish soup, cheese pizza.', [['pizza']]),
    clue('A1', 'The Secret Number', 'What is the number?', 'The number is bigger than 6 and smaller than 10.', 'The number is not 7. The number is not 9.', [['8', 'eight']]),
    clue('A1', 'Leo’s Sport', 'What is Leo’s sport?', 'Leo plays his sport with a ball.', 'Leo’s sport is swimming, tennis or running.', [['tennis']]),
    clue('A1', 'The Party', 'What day is the party?', 'The party is at the weekend.', 'The party is not on Sunday.', [['saturday']]),
    clue('A1', 'Anna’s Bag', 'What colour is Anna’s bag?', 'Anna’s bag is red or blue. Ben’s bag is green.', 'The blue bag is Carla’s bag.', [['red']]),
    clue('A1', 'The Tall Friend', 'Who is the tallest?', 'Eva is taller than Dan.', 'Dan is taller than Kim.', [['eva']]),
    clue('A1', 'The Key', 'Where is the key?', 'The key is in a bag. The bag is not on the chair.', 'There are two bags: a bag on the chair and a bag under the table.', [['under', 'table']]),
    clue('A2', 'The Right Train', 'Which train do you take? Write the time.', 'The trains to the city leave at 9:15, 10:40 and 12:05.', 'You can’t be at the station before 10:00. The 12:05 train is full.', [['10:40', '1040', '10 40', 'ten forty', '10.40']]),
    clue('A2', 'The Broken Window', 'Who broke the window?', 'The window broke at 5 pm. Ana was at the cinema all afternoon.', 'Carl was at the cinema with Ana. Ben was playing football in the garden at 5 pm.', [['ben']]),
    clue('A2', 'Cinema Night', 'How much money do you need? Write the number.', 'A cinema ticket costs 6 euros. Popcorn costs 4 euros.', 'You are 3 friends. You want 3 tickets and 1 popcorn.', [['22', 'twenty-two', 'twenty two']]),
    clue('A2', 'The Meeting', 'Which day can you meet?', 'I am free on Monday, Wednesday and Friday.', 'I am free on Tuesday, Wednesday and Thursday.', [['wednesday']]),
    clue('A2', 'The Door Code', 'What is the code? Write three numbers.', 'The code has three numbers. The first number is 4.', 'The second number is double the first. The third number is the first number minus 1.', [['483', '4 8 3', '4-8-3']]),
    clue('A2', 'The Treasure', 'Where is the treasure?', 'The treasure is not under the tree. It is near water.', 'There are three places: under the tree, next to the river, in the cave.', [['river']]),
    clue('A2', 'The School Trip', 'Where does the class go?', 'The class wants to see animals. The trip must cost less than 10 euros.', 'The zoo costs 12 euros. The farm costs 7 euros. The museum costs 5 euros.', [['farm']]),
    clue('A2', 'Whose Dog?', 'Who has the black dog?', 'Lia has a white dog. Marc doesn’t have a dog.', 'Three friends: Lia, Marc and Nil. One of them has a black dog.', [['nil']]),
    clue('A2', 'The Sandwich Thief', 'Who ate the sandwich?', 'The thief has got long hair and wears glasses.', 'Rita has long hair and no glasses. Pol has short hair and glasses. Jana has long hair and glasses.', [['jana']]),
    clue('A2', 'Late for School', 'What time does Alex arrive at school?', 'Alex leaves home at 8:10. The bus takes 25 minutes.', 'Alex waits 5 minutes for the bus. School starts at 8:30.', [['8:40', '840', '8 40', 'eight forty', '8.40', 'twenty to nine']]),
    clue('B1', 'Three Friends, Three Jobs', 'What is Maria’s job?', 'Maria isn’t the doctor. The teacher is a man.', 'The friends are Maria, Paul and Ines. The jobs are doctor, teacher and pilot. Ines is afraid of flying.', [['pilot']]),
    clue('B1', 'The Race', 'Who arrived first?', 'Kate arrived before Liam but after Noah.', 'Olivia arrived last. Four people ran: Kate, Liam, Noah and Olivia.', [['noah']]),
    clue('B1', 'The Day Trip', 'Which day is the trip?', 'The museum is closed on Mondays. The trip can’t be at the weekend.', 'Our teacher is away from Tuesday to Thursday.', [['friday']]),
    clue('B1', 'Sara’s Age', 'How old is Sara?', 'Sara is twice as old as her brother.', 'Her brother will be nine next year.', [['16', 'sixteen']]),
    clue('B1', 'The Password', 'What is the password? (a word and a number)', 'The password is an animal and then a number. The animal is the biggest land animal.', 'The number is the days in a week multiplied by two.', [['elephant'], ['14', 'fourteen']]),
    clue('B1', 'The Flat', 'Which flat should they rent: A, B or C?', 'They need two bedrooms and can pay up to 800 euros. They have a dog.', 'Flat A: 2 bedrooms, 750 euros, no pets. Flat B: 2 bedrooms, 790 euros, pets welcome. Flat C: 3 bedrooms, 900 euros, pets welcome.', [['flat b', 'b']]),
    clue('B1', 'The Stolen Painting', 'Who stole the painting?', 'The thief is left-handed and was in the museum after six.', 'The guard is right-handed. The cleaner left at five. The guide is left-handed and worked until eight.', [['guide']]),
    clue('B1', 'The Cheapest Way', 'Which is cheaper for the whole family: the car or the train? And how much is it?', 'The family is two adults and two children. Petrol and parking for the car cost 46 euros in total.', 'A train ticket is 14 euros for an adult. Children pay half price.', [['train'], ['42', 'forty-two', 'forty two']]),
    clue('B1', 'The Surprise Party', 'What time should the guests arrive?', 'Emma finishes work at six and it takes her forty minutes to get home.', 'The guests must be in the house twenty minutes before Emma arrives.', [['6:20', '620', '6 20', 'six twenty', '6.20', 'twenty past six']]),
    clue('B1', 'Who Sits Where?', 'Who sits in the middle?', 'Three people sit in a row. Iris doesn’t sit next to the window.', 'Hugo sits on the left, by the door. Greta, Hugo and Iris are the three people. The window is on the right.', [['iris']]),
];

// ---------- Riddle swap: read your riddle to your partner; they solve it ----------
const riddle = (level: Level, title: string, a: string, b: string, accept: string[][]): Quest => ({
    id: id('riddle'), title, level, size: 'any', minutes: 3, cat: 'Riddle swap', emoji: '🤔',
    text: 'You each have a riddle. Write your riddle for your partner and help them guess, but don’t answer your own! Then write BOTH answers together.',
    roles: [`Your riddle (for your partner): ${a}`, `Your riddle (for your partner): ${b}`], accept,
});

const RIDDLES: Quest[] = [
    riddle('A1', 'Yellow and Woof', 'I am yellow. Monkeys love me. What am I?', 'I have four legs and a tail. I say “woof”. What am I?', [['banana'], ['dog']]),
    riddle('A1', 'Sleep and Snow', 'You sleep in me every night. What am I?', 'I am cold and white. I fall from the sky in winter. What am I?', [['bed'], ['snow']]),
    riddle('A1', 'Time and Fruit', 'I have numbers and two hands. I tell you the time. What am I?', 'I am red or green. I am a fruit. I grow on a tree. What am I?', [['clock', 'watch'], ['apple']]),
    riddle('A1', 'Big and Small', 'I am very big and grey. I have a very long nose. What am I?', 'I am very small. I like cheese. Cats run after me. What am I?', [['elephant'], ['mouse']]),
    riddle('A1', 'Feet and Head', 'You wear us on your feet. There are two of us. What are we?', 'You wear me on your head when it is sunny. What am I?', [['shoe', 'sock', 'boot', 'trainer'], ['hat', 'cap']]),
    riddle('A1', 'School Things', 'You write with me. I am long and thin. What am I?', 'I am full of pages and stories. You read me. What am I?', [['pen', 'pencil'], ['book']]),
    riddle('A2', 'Hands and Shell', 'What has hands but can’t clap?', 'What do you have to break before you can use it?', [['clock', 'watch'], ['egg']]),
    riddle('A2', 'Wet and Tall', 'What gets wetter the more it dries?', 'I am tall when I am young and short when I am old. What am I?', [['towel'], ['candle']]),
    riddle('A2', 'Keys and Neck', 'What has keys but can’t open a door?', 'What has a neck but no head?', [['piano', 'keyboard'], ['bottle', 'shirt', 'guitar']]),
    riddle('A2', 'Teeth and Legs', 'What has teeth but can’t bite?', 'What has four legs but can’t walk?', [['comb', 'zip', 'saw'], ['table', 'chair', 'bed']]),
    riddle('A2', 'Up and Down', 'What goes up but never comes down?', 'What comes down but never goes up?', [['age'], ['rain', 'snow']]),
    riddle('A2', 'Words and Holes', 'What has words but never speaks?', 'What is full of holes but still holds water?', [['book', 'dictionary'], ['sponge']]),
    riddle('B1', 'Map and Stamp', 'I have cities but no houses, forests but no trees and rivers but no water. What am I?', 'What can travel around the world while staying in a corner?', [['map'], ['stamp']]),
    riddle('B1', 'Name and Future', 'What belongs to you, but other people use it more than you do?', 'What is always in front of you but can never be seen?', [['name'], ['future', 'tomorrow']]),
    riddle('B1', 'Steps and Cold', 'The more of them you take, the more you leave behind. What are they?', 'What can you catch but never throw?', [['step', 'footstep', 'footprint'], ['cold']]),
    riddle('B1', 'Room and Pot', 'What kind of room has no doors and no windows?', 'What begins with T, ends with T and has T in it?', [['mushroom'], ['teapot']]),
    riddle('B1', 'Silence and Echo', 'What is so fragile that saying its name breaks it?', 'I speak without a mouth and I answer when you shout in the mountains. What am I?', [['silence'], ['echo']]),
    riddle('B1', 'Secret and Shadow', 'If you have me, you want to share me. If you share me, you don’t have me any more. What am I?', 'I follow you all day in the sun, but I disappear when it is dark. What am I?', [['secret'], ['shadow']]),
];

// ---------- Half words: each player holds half of three words ----------
const halves = (level: Level, title: string, a: string[], b: string[], words: string[]): Quest => ({
    id: id('half'), title, level, size: 'any', minutes: 3, cat: 'Word halves', emoji: '🔤',
    text: 'You each have three half-words. Tell each other your halves and join them to make three new words. Write the three words.',
    roles: [`Your half-words: ${a.join(' · ')}`, `Your half-words: ${b.join(' · ')}`],
    accept: words.map(word => [word, word.replace(/([a-z])([A-Z])/g, '$1 $2')]),
});

const HALVES: Quest[] = [
    halves('A1', 'Sun, Foot, Tooth', ['SUN', 'BALL', 'TOOTH'], ['FLOWER', 'FOOT', 'BRUSH'], ['sunflower', 'football', 'toothbrush']),
    halves('A1', 'Bed, Rain, Snow', ['BED', 'BOW', 'SNOW'], ['ROOM', 'RAIN', 'MAN'], ['bedroom', 'rainbow', 'snowman']),
    halves('A1', 'Class, Home, Birth', ['CLASS', 'WORK', 'BIRTH'], ['ROOM', 'HOME', 'DAY'], ['classroom', 'homework', 'birthday']),
    halves('A1', 'Butter, Basket, Break', ['BUTTER', 'BALL', 'BREAK'], ['FLY', 'BASKET', 'FAST'], ['butterfly', 'basketball', 'breakfast']),
    halves('A2', 'Key, Pan, Skate', ['KEY', 'CAKE', 'SKATE'], ['BOARD', 'PAN', 'BOARD'], ['keyboard', 'pancake', 'skateboard']),
    halves('A2', 'Straw, Week, Air', ['STRAW', 'END', 'AIR'], ['BERRY', 'WEEK', 'PORT'], ['strawberry', 'weekend', 'airport']),
    halves('A2', 'Book, Sun, Hair', ['BOOK', 'GLASSES', 'HAIR'], ['SHOP', 'SUN', 'DRESSER'], ['bookshop', 'sunglasses', 'hairdresser']),
    halves('A2', 'Water, Grand, Note', ['WATER', 'MOTHER', 'NOTE'], ['MELON', 'GRAND', 'BOOK'], ['watermelon', 'grandmother', 'notebook']),
    halves('A2', 'Fire, Play, Earth', ['FIRE', 'GROUND', 'EARTH'], ['WORKS', 'PLAY', 'QUAKE'], ['fireworks', 'playground', 'earthquake']),
    halves('B1', 'Dead, Day, Sight', ['DEAD', 'DREAM', 'SIGHT'], ['LINE', 'DAY', 'SEEING'], ['deadline', 'daydream', 'sightseeing']),
    halves('B1', 'Back, Break, Head', ['BACK', 'DOWN', 'HEAD'], ['GROUND', 'BREAK', 'LINE'], ['background', 'breakdown', 'headline']),
    halves('B1', 'Over, Life, Out', ['OVER', 'STYLE', 'OUT'], ['COME', 'LIFE', 'DOORS'], ['overcome', 'lifestyle', 'outdoors']),
];

// ---------- Role-plays: two secret roles, and one fact to find out ----------
const play = (level: Level, title: string, question: string, a: string, b: string, accept?: string[][]): Quest => ({
    id: id('play'), title, level, size: 'any', minutes: 4, cat: 'Role-play', emoji: '🎭',
    text: `Act it out in the chat! You each have a secret role card. Then answer together: ${question}`,
    roles: [a, b], accept,
});

const PLAYS: Quest[] = [
    play('A1', 'The Pet Shop', 'What pet does the customer buy, and how much is it?',
        'You are a CUSTOMER in a pet shop. You want a small pet. You have 20 euros. Ask: “How much is…?”',
        'You work in a PET SHOP. Prices: a dog 90 euros, a rabbit 25 euros, a hamster 12 euros, a fish 5 euros. Say hello first!'),
    play('A1', 'The Ice Cream Van', 'What does the customer buy?',
        'You are a CUSTOMER. You love chocolate. You don’t like fruit. Ask: “Have you got…?”',
        'You sell ICE CREAM. Today you have: strawberry, lemon, vanilla and chocolate with banana. Chocolate is finished!'),
    play('A1', 'The New Student', 'Write two things you learned about the new student.',
        'You are a NEW STUDENT. Your name is Kim, you are from Korea, you are 12 and you love basketball. Answer the questions.',
        'A NEW STUDENT is in your class. Ask four questions: name, country, age, favourite sport.'),
    play('A1', 'Lost in School', 'Where is the music room?',
        'You are NEW at school. You are looking for the music room. Ask: “Excuse me, where is…?”',
        'You know the school. The music room is upstairs, next to the library, opposite Room 12. Help the new student!', [['library', 'upstairs', '12']]),
    play('A2', 'The Clothes Shop', 'How much does the customer pay?',
        'You are a CUSTOMER. You want a blue jacket, size M. You have 30 euros. Ask about colours, sizes and prices.',
        'You work in a CLOTHES SHOP. Jackets are red or blue. Blue jackets cost 35 euros, but today everything is 10 euros cheaper.', [['25', 'twenty-five', 'twenty five']]),
    play('A2', 'The Restaurant', 'What does the customer order?',
        'You are a CUSTOMER. You are vegetarian and you have 12 euros. You want a main dish and a drink.',
        'You are the WAITER. Menu: burger 9, veggie pasta 8, cheese salad 6, chicken soup 5, juice 3, water 1. Ask: “Are you ready to order?”'),
    play('A2', 'Lost Property', 'Which bag belongs to the student: 1, 2 or 3?',
        'You LOST your bag. It is black with a red star. Inside: a maths book and a blue water bottle. Describe it!',
        'You work at LOST PROPERTY. Bag 1: black, with a yellow star, a maths book. Bag 2: black, a red star, a blue bottle and a maths book. Bag 3: red, a black star, a blue bottle. Ask questions!', [['2', 'two']]),
    play('A2', 'The Doctor', 'What must the patient do? Write the doctor’s advice.',
        'You are the PATIENT. You have a headache and you are very tired. You go to bed at 1 am because you play video games.',
        'You are the DOCTOR. Ask about the problem, sleep, food and screens. Then give two pieces of advice with “You should…”.'),
    play('A2', 'The Birthday Present', 'What present do you choose for Alex?',
        'You know ALEX well: Alex loves music and cooking, hates sport, and already has headphones.',
        'You have the SHOP LIST: headphones 30 euros, a football 15, a cookbook 14, a guitar 120. You have 20 euros together.', [['cookbook', 'cook book', 'book']]),
    play('B1', 'The Hotel Problem', 'How does the hotel solve the problem?',
        'You are a GUEST. Your room is noisy, the shower is cold and you booked a sea view but you can see the car park. You are annoyed but polite.',
        'You are the RECEPTIONIST. The hotel is almost full. There is one free room with a sea view, but it costs 20 euros more. You can offer free breakfast.'),
    play('B1', 'The Job Interview', 'Does the student get the job? Why?',
        'You are a STUDENT who wants a summer job in a café. You are friendly and speak three languages, but you can’t work on Sundays.',
        'You are the CAFÉ OWNER. You need someone friendly who can work at weekends. Ask about experience, languages and free days. Then decide.'),
    play('B1', 'The Flatmates', 'Write the two rules you both agreed on.',
        'You are a FLATMATE who loves cooking late at night and listening to music. You hate washing the dishes.',
        'You are a FLATMATE who gets up at six for work and needs a quiet, clean kitchen. You want some house rules. Negotiate!'),
    play('B1', 'The Complaint', 'What does the shop offer in the end?',
        'You bought a PHONE last week and the screen stopped working. You have the receipt. You want your money back.',
        'You are the SHOP MANAGER. You can’t give money back, but you can repair the phone in three days, or exchange it for a new one today.'),
];

// ---------- Open talk: the answer is a short report ----------
const talk = (level: Level, cat: string, emoji: string, title: string, text: string, size: Quest['size'] = 'any'): Quest =>
    ({ id: id('talk'), title, level, size, minutes: 4, cat, emoji, text });

const TALKS: Quest[] = [
    talk('A1', 'In common', '🤝', 'Three in Common', 'Ask each other questions. Find 3 things you ALL like. Write: “We all like…”'),
    talk('A1', 'In common', '🤝', 'Same and Different', 'Talk about food. Find one food you all love and one food only ONE of you likes. Write both.'),
    talk('A2', 'In common', '🤝', 'Weekend Twins', 'Ask about last weekend. Find 2 things you all did, and 1 thing only one of you did. Write them.'),
    talk('A2', 'In common', '🤝', 'Never Ever', 'Find 3 things that NOBODY at your table has ever done. Write: “None of us has ever…”'),
    talk('B1', 'In common', '🤝', 'Strong Opinions', 'Find one thing you all think is overrated and one thing you all think is underrated. Explain why.'),
    talk('B1', 'In common', '🤝', 'Hidden Links', 'Find three surprising things you have in common. Not allowed: age, school, town. Write them.'),
    talk('A1', 'Interview', '🎤', 'My Partner’s Day', 'Ask a classmate 3 questions about their day. Write 2 sentences about THEM: “She gets up at…”'),
    talk('A1', 'Interview', '🎤', 'Favourite Things', 'Ask a classmate about their favourite food, colour and animal. Write about THEM, not you.'),
    talk('A2', 'Interview', '🎤', 'The Best Holiday', 'Ask a classmate about their best holiday: where, when, who with, what they did. Write 2 sentences about it.'),
    talk('A2', 'Interview', '🎤', 'Future Me', 'Ask a classmate about their plans: next weekend, next summer, when they are 25. Write 2 sentences about THEM.'),
    talk('B1', 'Interview', '🎤', 'Three Wishes', 'Ask a classmate what three wishes they would make and why. Write which wish surprised you most.'),
    talk('B1', 'Interview', '🎤', 'The Expert', 'Find something a classmate knows a lot about. Ask four questions. Write the most interesting thing you learned.'),
    talk('A1', 'Plan it', '📋', 'The Perfect Picnic', 'Plan a picnic together. Choose a place, 3 foods and 1 game. Write your plan.'),
    talk('A1', 'Plan it', '📋', 'Our Class Pet', 'Your class can have a pet. Choose the animal and its name. Write: “Our pet is a… Its name is…”'),
    talk('A2', 'Plan it', '📋', 'The Class Trip', 'Plan a one-day class trip. Agree on where to go, how to travel and what to take. Write your plan.'),
    talk('A2', 'Plan it', '📋', 'The Best Party', 'Plan a party with 20 euros. Agree on food, music and one game. Write what you will buy.'),
    talk('B1', 'Plan it', '📋', 'A New Club', 'Invent a new school club. Agree on its name, what members do and one rule. Write your idea.'),
    talk('B1', 'Plan it', '📋', 'Our Tiny Country', 'Invent a tiny country. Agree on its name, its flag and its two most important laws. Write them.'),
    talk('A1', 'Top three', '🏅', 'Best Pets', 'Agree on the 3 best pets. Put them in order: 1, 2, 3. Write your list.'),
    talk('A2', 'Top three', '🏅', 'School Subjects', 'Agree on the 3 most useful school subjects. Put them in order and give one reason.'),
    talk('A2', 'Top three', '🏅', 'Inventions', 'Agree on the 3 best inventions ever. Put them in order and say why number 1 is first.'),
    talk('B1', 'Top three', '🏅', 'A Good Friend', 'Agree on the 3 most important qualities of a good friend. Put them in order and explain number 1.'),
    talk('A1', 'Make a story', '✏️', 'The Hungry Monster', 'Write a 3-sentence story about a hungry monster. Each player writes one sentence in the chat first.', 'group'),
    talk('A2', 'Make a story', '✏️', 'The Strange Door', 'You find a strange door at school. Decide together: what is behind it? Write 3 sentences.'),
    talk('B1', 'Make a story', '✏️', 'The Wrong Bag', 'Someone takes the wrong bag at the airport. Decide what is in it and what happens. Write the ending.'),
];

type Raw = { id: string; title: string; level: Level; size: 'pair' | 'group'; minutes: number; cat: string; text: string };
const CLASSIC: Quest[] = (talk200 as Raw[]).map(quest => ({ ...quest, emoji: quest.size === 'pair' ? '💬' : '👥' }));

export const NEW_QUESTS: Quest[] = [...CLUES, ...RIDDLES, ...HALVES, ...PLAYS, ...TALKS];
export const QUESTS: Quest[] = [...NEW_QUESTS, ...CLASSIC];
