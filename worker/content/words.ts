// Words and pictures for the guessing, describing and story games. Each thing is an emoji and the word for it, so a
// student always sees the English word beside the picture.
import type { Level } from '../../shared/protocol.ts';

export type Thing = { emoji: string; word: string };
export type ThingSet = { id: string; title: string; level: Level; article: boolean; things: Thing[]; ask: string[] };

const things = (text: string): Thing[] => text.trim().split(/\s*,\s*/).map(entry => {
    const [emoji, ...word] = entry.split(' ');
    return { emoji, word: word.join(' ') };
});

// Things to be, to describe and to guess. `ask` are yes/no questions that work for the set.
export const THING_SETS: ThingSet[] = [
    { id: 'animals', title: 'Animals', level: 'A1', article: true,
        things: things('🐶 dog, 🐱 cat, 🐘 elephant, 🦁 lion, 🐒 monkey, 🐍 snake, 🐟 fish, 🐦 bird, 🐴 horse, 🐄 cow, 🐷 pig, 🐇 rabbit, 🐢 turtle, 🦈 shark, 🐧 penguin, 🦒 giraffe, 🐻 bear, 🐸 frog, 🦋 butterfly, 🐝 bee, 🐑 sheep, 🐔 chicken, 🐊 crocodile, 🐬 dolphin'),
        ask: ['Are you big?', 'Can you fly?', 'Do you live in water?', 'Have you got four legs?', 'Do you eat meat?', 'Do you live on a farm?', 'Are you dangerous?', 'Can you swim?'] },
    { id: 'food', title: 'Food', level: 'A1', article: false,
        things: things('🍎 apple, 🍌 banana, 🍕 pizza, 🍔 burger, 🍦 ice cream, 🥕 carrot, 🍞 bread, 🧀 cheese, 🥚 egg, 🍫 chocolate, 🍓 strawberry, 🍊 orange, 🍅 tomato, 🍟 chips, 🥛 milk, 🍚 rice, 🍝 pasta, 🍉 watermelon, 🥗 salad, 🍪 biscuit, 🍗 chicken, 🐟 fish, 🍋 lemon, 🥔 potato'),
        ask: ['Are you sweet?', 'Are you a fruit?', 'Are you red?', 'Do people eat you hot?', 'Are you healthy?', 'Do people eat you for breakfast?', 'Are you a drink?', 'Do you grow on a tree?'] },
    { id: 'objects', title: 'Things', level: 'A1', article: true,
        things: things('📱 phone, 📚 book, ✏️ pencil, 🪑 chair, 🛏️ bed, ⏰ clock, 🔑 key, ☂️ umbrella, 🎒 school bag, ⚽ ball, 🚲 bike, 💡 lamp, 🪥 toothbrush, 👓 glasses, 🧢 cap, 👟 shoe, 🖥️ computer, 📷 camera, 🎸 guitar, ✂️ scissors, 🧸 teddy bear, 🚪 door, 🪟 window, 🧦 sock'),
        ask: ['Are you big?', 'Are you in a classroom?', 'Can people wear you?', 'Are you in a bedroom?', 'Do people use you every day?', 'Are you made of metal?', 'Can I hold you in one hand?', 'Do you use electricity?'] },
    { id: 'jobs', title: 'Jobs', level: 'A2', article: true,
        things: things('👩‍⚕️ doctor, 👨‍🍳 chef, 👩‍🏫 teacher, 👨‍🚒 firefighter, 👮 police officer, 👩‍✈️ pilot, 👨‍🌾 farmer, 👩‍🎤 singer, 👨‍🔧 mechanic, 👩‍🔬 scientist, 👨‍🎨 painter, 👩‍🚀 astronaut, 🦷 dentist, ⚽ footballer, 🎬 actor, 📸 photographer, 🚕 taxi driver, 💇 hairdresser, 🧑‍💻 programmer, 🐕 vet, 📰 journalist, 🧑‍⚖️ judge, 🏗️ builder, 🛒 shop assistant'),
        ask: ['Do you work outside?', 'Do you wear a uniform?', 'Do you help people?', 'Do you work with animals?', 'Are you famous?', 'Do you work at night?', 'Do you use a computer?', 'Do you work in a hospital?'] },
    { id: 'places', title: 'Places', level: 'A2', article: true,
        things: things('🏫 school, 🏥 hospital, 🛒 supermarket, 🏖️ beach, 🎬 cinema, 🏛️ museum, 🏟️ stadium, ✈️ airport, 🍽️ restaurant, 📚 library, 🏊 swimming pool, 🌳 park, 🦁 zoo, 🚉 train station, 🏦 bank, ⛪ church, 🏨 hotel, 🎡 funfair, 🏔️ mountain, 🏝️ island, 🌾 farm, 💈 hairdresser’s, 🥖 bakery, 🏰 castle'),
        ask: ['Are you inside or outside?', 'Do people pay to go there?', 'Is it noisy there?', 'Do people eat there?', 'Do children go there?', 'Can you buy things there?', 'Is it in every town?', 'Do people work there?'] },
    { id: 'transport', title: 'Transport & sport', level: 'A2', article: true,
        things: things('🚗 car, 🚌 bus, 🚆 train, ✈️ plane, 🚢 ship, 🚁 helicopter, 🚲 bike, 🛴 scooter, 🏍️ motorbike, 🚀 rocket, 🚕 taxi, 🚜 tractor, 🛶 canoe, 🛹 skateboard, 🎿 ski, 🏄 surfboard, 🚑 ambulance, 🚒 fire engine, 🛳️ ferry, 🚂 steam train, 🛺 tuk-tuk, 🚠 cable car, 🎈 hot-air balloon, 🛷 sledge'),
        ask: ['Have you got wheels?', 'Can you fly?', 'Do you go on water?', 'Are you fast?', 'Can many people use you together?', 'Have you got an engine?', 'Are you expensive?', 'Do you go on snow?'] },
];

export const thingSetsFor = (level: Level): ThingSet[] => {
    const order: Level[] = ['A1', 'A2', 'B1'];
    return THING_SETS.filter(set => order.indexOf(set.level) <= order.indexOf(level));
};
export const withArticle = (thing: Thing, set: { article: boolean }): string =>
    !set.article ? thing.word : `${/^[aeiou]/i.test(thing.word) ? 'an' : 'a'} ${thing.word}`;

// ---------- Don't say it! ----------
// A word to describe, and words the describer cannot use either.
export type Taboo = { word: string; level: Level; banned: string[] };
const taboo = (level: Level, text: string): Taboo[] => text.trim().split('\n').map(line => {
    const [word, banned] = line.split(':').map(part => part.trim());
    return { word, level, banned: banned.split(',').map(item => item.trim()).filter(Boolean) };
});

export const TABOO: Taboo[] = [
    ...taboo('A1', `
        dog: animal, pet
        cat: animal, pet
        school: teacher, class
        pizza: food, Italy
        apple: fruit, red
        football: ball, sport
        bed: sleep, bedroom
        car: drive, road
        book: read, pages
        sun: hot, sky
        water: drink, sea
        teacher: school, class
        birthday: cake, party
        phone: call, mobile
        rain: water, weather
        milk: white, cow
        chair: sit, table
        fish: water, swim
        banana: yellow, fruit
        shoes: feet, wear
        mother: mum, family
        bike: ride, wheels
        ice cream: cold, summer
        elephant: big, grey
        chocolate: sweet, brown
        house: live, home
        hat: head, wear
        baby: small, child
        window: glass, open
        egg: chicken, breakfast
        tree: green, leaves
        clock: time, hour
        door: open, close
        beach: sea, sand
        bus: drive, school
        snow: white, cold
        bird: fly, wings
        pencil: write, draw
        eyes: see, face
        breakfast: morning, eat`),
    ...taboo('A2', `
        hospital: doctor, sick, nurse
        holiday: summer, travel, beach
        homework: school, teacher, home
        airport: plane, fly, travel
        supermarket: shop, buy, food
        umbrella: rain, wet, open
        doctor: hospital, sick, medicine
        kitchen: cook, food, room
        weekend: Saturday, Sunday, school
        cinema: film, movie, watch
        dentist: teeth, tooth, doctor
        library: books, read, quiet
        swimming pool: swim, water, summer
        guitar: music, play, instrument
        sandwich: bread, eat, lunch
        passport: travel, country, airport
        mirror: see, look, face
        friend: like, play, together
        winter: cold, snow, season
        farmer: animals, farm, tractor
        neighbour: house, next, live
        pillow: bed, sleep, head
        ticket: buy, train, cinema
        mountain: high, climb, snow
        recipe: cook, food, kitchen
        password: secret, computer, phone
        suitcase: travel, clothes, holiday
        museum: old, art, visit
        dream: sleep, night, bed
        cousin: family, aunt, uncle
        fridge: cold, kitchen, food
        zoo: animals, visit, lion
        present: birthday, give, Christmas
        firefighter: fire, water, truck
        camping: tent, sleep, outside
        exam: test, school, study
        photo: camera, picture, take
        queue: wait, line, people
        towel: dry, shower, beach
        timetable: school, lessons, time`),
    ...taboo('B1', `
        volunteer: help, free, work, money
        pollution: dirty, air, cars, environment
        influencer: social media, followers, videos, famous
        advertisement: sell, product, TV, buy
        homesick: miss, family, away, sad
        recycling: rubbish, bottles, paper, environment
        deadline: time, finish, work, late
        argument: fight, angry, disagree, shout
        souvenir: holiday, buy, remember, shop
        traffic jam: cars, road, slow, wait
        scholarship: money, study, university, pay
        rumour: true, people, say, secret
        earthquake: ground, shake, disaster, building
        competition: win, prize, best, lose
        embarrassed: red, face, feel, shy
        babysitter: children, look after, parents, money
        nightmare: dream, bad, sleep, scared
        subscription: pay, month, Netflix, money
        jet lag: plane, tired, time, travel
        vegetarian: meat, eat, vegetables, animals
        pocket money: parents, week, give, children
        eyewitness: see, crime, police, happen
        procrastinate: later, homework, do, time
        generation: age, parents, old, young
        charity: money, help, give, poor
        stage fright: nervous, people, speak, theatre
        hitchhike: car, thumb, road, travel
        compromise: agree, both, middle, argument
        loyal: friend, always, trust, dog
        bargain: cheap, price, buy, shop`),
];

export const DESCRIBE: Record<Level, string[]> = {
    A1: ['It is a thing.', 'It is an animal.', 'It is a place.', 'It is big.', 'It is small.', 'You can … it.', 'It is not …'],
    A2: ['It is a thing that …', 'It is a place where …', 'It is a person who …', 'You use it to …', 'It is the opposite of …', 'You can find it in …'],
    B1: ['It is something that …', 'It is what happens when …', 'It is a kind of …', 'People do this when …', 'It is similar to …, but …', 'It is the feeling you have when …'],
};

// ---------- Name 10! ----------
// Words the game already knows are right. Anything else is asked about: a classmate can say it counts.
export type Category = { id: string; title: string; emoji: string; level: Level; words: string[] };
const category = (id: string, title: string, emoji: string, level: Level, words: string): Category =>
    ({ id, title, emoji, level, words: words.trim().split(/\s*,\s*/) });

export const CATEGORIES: Category[] = [
    category('kitchen', 'things in a kitchen', '🍳', 'A1', 'fridge, cooker, oven, table, chair, plate, glass, cup, fork, knife, spoon, pan, pot, sink, microwave, bowl, bottle, food, water, bread, kettle, toaster, freezer, cupboard, tap, dishwasher, mug, jar, napkin, bin'),
    category('classroom', 'things in a classroom', '🏫', 'A1', 'desk, chair, table, board, book, pen, pencil, rubber, ruler, bag, teacher, student, computer, window, door, clock, notebook, paper, map, poster, scissors, glue, pencil case, tablet, laptop, projector, bin, whiteboard, dictionary, marker'),
    category('animals', 'animals', '🐾', 'A1', 'dog, cat, bird, fish, horse, cow, pig, sheep, lion, tiger, elephant, monkey, snake, rabbit, mouse, bear, duck, chicken, frog, giraffe, zebra, shark, whale, dolphin, penguin, wolf, fox, goat, turtle, spider, bee, butterfly, crocodile, kangaroo, parrot, hamster, camel, donkey, deer, owl'),
    category('food', 'things you can eat', '🍽️', 'A1', 'apple, banana, orange, bread, cheese, egg, pizza, pasta, rice, chicken, fish, meat, salad, tomato, potato, carrot, chocolate, cake, ice cream, sandwich, burger, soup, biscuit, strawberry, grapes, pear, lemon, onion, chips, sausage, yoghurt, cereal, butter, ham, peach, melon, beans, corn, honey'),
    category('clothes', 'clothes', '👕', 'A1', 'shirt, t-shirt, trousers, jeans, skirt, dress, shoes, socks, hat, cap, jacket, coat, jumper, scarf, gloves, boots, trainers, shorts, pyjamas, tie, belt, sweater, hoodie, sandals, swimsuit, uniform, tracksuit, raincoat, leggings, slippers'),
    category('body', 'parts of the body', '🖐️', 'A1', 'head, hair, eye, ear, nose, mouth, tooth, teeth, neck, arm, hand, finger, leg, foot, feet, toe, knee, back, shoulder, face, stomach, elbow, chin, lips, tongue, thumb, heart, skin, chest, ankle'),
    category('colours', 'colours and shapes', '🎨', 'A1', 'red, blue, green, yellow, orange, purple, pink, black, white, brown, grey, gold, silver, circle, square, triangle, rectangle, star, heart, violet, turquoise, beige, navy, cream, oval, diamond, line'),
    category('town', 'places in a town', '🏙️', 'A2', 'school, park, shop, supermarket, hospital, cinema, museum, library, restaurant, cafe, bank, station, church, hotel, stadium, swimming pool, post office, police station, market, bakery, chemist, square, theatre, gym, zoo, airport, bus stop, bridge, town hall, shopping centre, pharmacy, playground, car park, university'),
    category('jobs', 'jobs', '💼', 'A2', 'teacher, doctor, nurse, police officer, firefighter, chef, cook, waiter, pilot, farmer, driver, singer, actor, dentist, vet, engineer, mechanic, builder, hairdresser, artist, writer, scientist, footballer, lawyer, journalist, photographer, programmer, cleaner, baker, plumber, electrician, shop assistant, architect, musician, astronaut'),
    category('sports', 'sports and hobbies', '🏅', 'A2', 'football, basketball, tennis, swimming, running, cycling, volleyball, skiing, dancing, reading, drawing, painting, singing, chess, gaming, skating, surfing, judo, karate, gymnastics, hockey, rugby, golf, handball, fishing, climbing, cooking, photography, hiking, boxing, yoga, baseball, athletics, sailing, table tennis'),
    category('beach', 'things you take to the beach', '🏖️', 'A2', 'towel, swimsuit, sunglasses, sun cream, hat, umbrella, ball, water, sandwich, book, bucket, spade, flip-flops, bag, surfboard, snorkel, goggles, cap, music, phone, camera, chair, food, drinks, money, t-shirt, shorts, sandals, fruit, cards'),
    category('weather', 'weather and nature words', '⛅', 'A2', 'sun, rain, snow, wind, cloud, storm, fog, ice, river, sea, lake, mountain, forest, tree, flower, beach, island, desert, sky, star, moon, hill, grass, rainbow, thunder, lightning, waterfall, volcano, valley, field, ocean, cave, jungle'),
    category('feelings', 'feelings', '😊', 'B1', 'happy, sad, angry, tired, bored, excited, nervous, scared, worried, surprised, proud, shy, jealous, lonely, calm, relaxed, confused, embarrassed, disappointed, annoyed, cheerful, upset, stressed, curious, grateful, hopeful, frightened, delighted, anxious, confident, guilty, amazed'),
    category('travel', 'things you need to travel', '🧳', 'B1', 'passport, ticket, suitcase, money, map, phone, charger, camera, clothes, backpack, visa, hotel, guidebook, sunglasses, toothbrush, credit card, insurance, boarding pass, luggage, reservation, itinerary, headphones, medicine, snacks, umbrella, pillow, wallet, towel, adapter, id card'),
    category('adjectives', 'words to describe a person', '🧑', 'B1', 'kind, funny, friendly, clever, shy, brave, lazy, honest, polite, rude, generous, patient, creative, serious, quiet, noisy, tall, short, strong, helpful, cheerful, selfish, confident, stubborn, sensible, curious, calm, reliable, talkative, hard-working, easy-going, ambitious'),
];

// ---------- Story dice ----------
export const DICE: Thing[] = things('🐉 dragon, 🍕 pizza, 🚲 bike, 🌧️ rain, 🔑 key, 🏰 castle, 🚀 rocket, 🐱 cat, 👻 ghost, 🎂 cake, 🌙 moon, 🧙 wizard, 🏝️ island, 📱 phone, 🐘 elephant, 🎁 present, 🌋 volcano, 🚪 door, 🧦 sock, 👑 king, 🤖 robot, 🍦 ice cream, 🌳 tree, 🎸 guitar, 🐒 monkey, 🕰️ clock, 🧳 suitcase, 🦈 shark, ⛄ snowman, 🍎 apple, 🚌 bus, 👽 alien, 📚 book, 🕷️ spider, 🏆 prize, 🎈 balloon, 🧀 cheese, 🛶 boat, 🗺️ map, 💎 diamond, 🐸 frog, 🎩 hat, 🔦 torch, 🌈 rainbow, 🍄 mushroom, 🦉 owl, 🧲 magnet, 🎪 circus, 🥁 drum, 🪞 mirror');

export const STORY_STARTS: Record<Level, string[]> = {
    A1: ['One day,', 'Then', 'After that,', 'Suddenly,', 'In the end,', 'There is a', 'It is'],
    A2: ['One day,', 'Suddenly,', 'After that,', 'A few minutes later,', 'Luckily,', 'In the end,', 'While'],
    B1: ['It all started when', 'Without warning,', 'To everyone’s surprise,', 'Meanwhile,', 'As soon as', 'Unfortunately,', 'In the end,'],
};

// ---------- Find the spy ----------
export const SPY_PLACES: Thing[] = things('🛒 supermarket, 🏥 hospital, 🏖️ beach, 🎬 cinema, 🏫 school, ✈️ airport, 🍽️ restaurant, 🦁 zoo, 🏊 swimming pool, 📚 library, 🏟️ football stadium, 🚉 train station, 🎡 funfair, 🏛️ museum, 🏨 hotel, 🌾 farm, 🎂 birthday party, 🏕️ campsite, 🚢 cruise ship, 🏋️ gym, 💇 hairdresser’s, 🥖 bakery, 🚀 space station, 🏰 castle');

// ---------- Pack the bag ----------
export type Scenario = { id: string; level: Level; emoji: string; title: string; text: string; pick: number; items: Thing[] };
export const SCENARIOS: Scenario[] = [
    { id: 'island', level: 'A1', emoji: '🏝️', title: 'The island', text: 'You are going to a small island for a week. There are no shops.', pick: 3,
        items: things('💧 water, 🔪 knife, 📱 phone, ⛺ tent, 🎣 fishing rod, 🔥 matches, 📚 book, ⚽ ball, 🍫 chocolate, 🧴 sun cream') },
    { id: 'picnic', level: 'A1', emoji: '🧺', title: 'The picnic', text: 'Your class is having a picnic in the park.', pick: 3,
        items: things('🥪 sandwiches, 🍉 watermelon, ⚽ ball, 🎸 guitar, 🧃 juice, 🍰 cake, 🪁 kite, 🃏 cards, 🍕 pizza, 🧊 ice') },
    { id: 'snow', level: 'A1', emoji: '🏔️', title: 'The snow trip', text: 'You are going to the mountains. It is very cold.', pick: 3,
        items: things('🧤 gloves, 🧣 scarf, 🛷 sledge, ☕ hot chocolate, 📷 camera, 🥾 boots, 🕶️ sunglasses, 🍫 chocolate, 🧦 extra socks, 🔦 torch') },
    { id: 'party', level: 'A2', emoji: '🎉', title: 'The class party', text: 'You have 30 euros for a class party. You can only buy three things.', pick: 3,
        items: things('🍕 pizzas, 🎈 balloons, 🎵 a speaker for music, 🍰 a big cake, 🥤 drinks, 🎮 a video game, 🎭 costumes, 🍿 popcorn, 🎁 small prizes, 📸 a photo corner') },
    { id: 'space', level: 'A2', emoji: '🚀', title: 'The space trip', text: 'You are going to live on the Moon for a month. Space in the rocket is small.', pick: 3,
        items: things('🎸 a guitar, 📚 your favourite books, 🪴 a plant, 📷 a camera, 🧸 something from home, 🎮 a games console, 🍫 a lot of chocolate, 📓 a diary, 🏐 a ball, 🔭 a telescope') },
    { id: 'newstudent', level: 'A2', emoji: '👋', title: 'The new student', text: 'A new student is coming to your class from another country. What three things will help them most?', pick: 3,
        items: things('🗺️ a tour of the school, 🍽️ lunch together, 📖 help with homework, ⚽ a game at break time, 📱 a class group chat, 🎒 a welcome present, 📝 a list of useful words, 🎉 a welcome party, 🧑‍🤝‍🧑 a class friend for the week, 🗓️ the timetable') },
    { id: 'town', level: 'B1', emoji: '🏙️', title: 'A better town', text: 'The town has money for only three new things for young people. Which three?', pick: 3,
        items: things('🛹 a skate park, 📚 a bigger library, 🎬 a cinema, 🏊 a swimming pool, 🎵 a music studio, 🌳 a new park, 🚲 bike lanes, 🎮 a gaming centre, 🧗 a climbing wall, 🚌 free buses at night') },
    { id: 'survival', level: 'B1', emoji: '🧭', title: 'Lost in the forest', text: 'Your group is lost in a forest. Night is coming and help will arrive tomorrow.', pick: 3,
        items: things('🔦 a torch, 🧭 a compass, 🔥 a lighter, 🍫 energy bars, 🧥 a warm blanket, 📱 a phone with 5% battery, 🔪 a pocket knife, 💧 a bottle of water, 🗺️ an old map, 📯 a whistle') },
    { id: 'school', level: 'B1', emoji: '🏫', title: 'The perfect school', text: 'You are designing a new school. You can add only three special things.', pick: 3,
        items: things('🛋️ a room to relax, 🍳 cooking lessons, 🕙 a later start, 🐕 school pets, 💻 a laptop for everyone, 🌱 a school garden, 🎭 a theatre, 🏖️ no homework, 🌍 trips abroad, 🤖 a robotics lab') },
];

// ---------- Tic-Tac-Talk ----------
export type WordSet = { id: string; title: string; level: Level; tip: string; words: string[] };
const wordSet = (id: string, title: string, level: Level, tip: string, words: string): WordSet => ({ id, title, level, tip, words: words.trim().split(/\s*,\s*/) });
export const WORD_SETS: WordSet[] = [
    wordSet('a1verbs', 'Everyday verbs', 'A1', 'I … every day.', 'like, play, eat, go, have, read, watch, drink, sleep, run, sing, cook, swim, help, want, live'),
    wordSet('a1things', 'Everyday things', 'A1', 'My … is …', 'house, school, friend, dog, book, family, car, food, game, park, phone, birthday, teacher, bike, music, weekend'),
    wordSet('a1adj', 'Describing words', 'A1', 'It is very …', 'big, small, happy, funny, fast, cold, hot, new, old, nice, easy, tall, tired, hungry, good, beautiful'),
    wordSet('a2past', 'Past verbs', 'A2', 'Yesterday I …', 'went, saw, ate, bought, played, had, made, found, met, took, came, wrote, gave, lost, won, forgot'),
    wordSet('a2often', 'How often?', 'A2', 'I … go to …', 'always, never, sometimes, usually, often, every day, once a week, at the weekend, in the morning, at night, on Mondays, twice a year, hardly ever, after school, in summer, every year'),
    wordSet('a2compare', 'Comparing', 'A2', '… is … than …', 'bigger, better, faster, more interesting, worse, older, funnier, cheaper, more difficult, easier, the best, the worst, taller, more expensive, the most, as good as'),
    wordSet('a2link', 'Joining words', 'A2', 'I like … because …', 'because, but, and, so, when, then, before, after, or, also, too, if, first, finally, with, without'),
    wordSet('b1link', 'Connectors', 'B1', 'Although …, …', 'although, however, unless, while, since, as soon as, instead of, in case, even if, whereas, despite, as long as, therefore, until, in order to, otherwise'),
    wordSet('b1perfect', 'Have you ever…?', 'B1', 'I have never …', 'ever, never, already, yet, just, since, for, been, seen, done, tried, lost, met, broken, forgotten, travelled'),
    wordSet('b1phrasal', 'Phrasal verbs', 'B1', 'I always … my …', 'give up, look for, find out, get on with, look after, turn off, pick up, run out of, put off, come across, carry on, set up, take up, look forward to, get over, break down'),
];
