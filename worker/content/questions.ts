// Conversation questions, by topic and level. Every question game deals from here (or from the teacher's own list).
// `ask` are beginnings of questions a student can tap to start their own.
import type { Level } from '../../shared/protocol.ts';

export type Topic = { id: string; title: string; emoji: string; q: Record<Level, string[]>; ask: string[] };

export const TOPICS: Topic[] = [
    {
        id: 'me', title: 'About you', emoji: '🙂',
        q: {
            A1: ['What is your favourite colour?', 'How old are you?', 'What is your favourite day of the week?', 'Do you like mornings or evenings?', 'What makes you happy?', 'What is your favourite number?', 'Are you a quiet person or a noisy person?', 'What is your favourite season?', 'What can you do very well?', 'What time do you get up?'],
            A2: ['What are you good at?', 'What do you usually do when you are bored?', 'What is something you can’t live without?', 'What was your favourite toy when you were little?', 'What is a small thing that makes your day better?', 'Are you more like your mum or your dad? How?', 'What are you afraid of?', 'What do your friends like about you?', 'What is your best memory from last year?', 'What is one thing you want to learn?'],
            B1: ['How have you changed in the last three years?', 'What is something most people don’t know about you?', 'What would your perfect day look like?', 'What is a habit you would like to change?', 'Who has taught you the most in your life?', 'What are you proud of?', 'What kind of person would you like to be in ten years?', 'What is the best advice you have ever received?', 'When do you feel most like yourself?', 'What is something you used to believe when you were a child?'],
        },
        ask: ['What is your favourite …?', 'Do you like …?', 'Are you …?', 'What do you think about …?', 'How often do you …?'],
    },
    {
        id: 'free', title: 'Free time', emoji: '🎮',
        q: {
            A1: ['What do you do after school?', 'What is your favourite game?', 'Do you play a sport? Which one?', 'What do you watch on TV?', 'What music do you like?', 'Do you like reading? What do you read?', 'What do you do on Saturdays?', 'Can you play an instrument?', 'Who do you play with?', 'Do you like dancing?'],
            A2: ['What do you usually do at the weekend?', 'What is the best film you have seen this year?', 'How much time do you spend on your phone every day?', 'What hobby would you like to try?', 'Do you prefer playing sports or watching them? Why?', 'What do you do when it rains all day?', 'Tell me about a game you love. How do you play it?', 'What kind of videos do you watch?', 'Do you collect anything?', 'What do you and your friends do together?'],
            B1: ['How has the way you spend your free time changed since you were a child?', 'Is it better to have one hobby or many? Why?', 'What would you do if you had a free week with no phone?', 'Which hobby is a waste of time, in your opinion?', 'What is a film or series you would recommend, and why?', 'Do young people have enough free time?', 'Would you rather be great at a sport or at music? Why?', 'What is something creative you have made?'],
        },
        ask: ['What do you do …?', 'Do you like playing …?', 'How often do you …?', 'Who do you … with?', 'What is your favourite …?'],
    },
    {
        id: 'food', title: 'Food', emoji: '🍕',
        q: {
            A1: ['What is your favourite food?', 'What do you eat for breakfast?', 'Do you like vegetables?', 'What food do you hate?', 'Can you cook? What can you make?', 'What is your favourite fruit?', 'What do you drink at lunch?', 'Do you like pizza or pasta more?', 'What do you eat on your birthday?', 'What is your favourite ice cream?'],
            A2: ['What did you have for dinner yesterday?', 'What is the strangest food you have ever tried?', 'Who cooks the best food in your family?', 'What do people eat at festivals in your town?', 'Do you prefer sweet or salty food? Why?', 'What would you cook for a friend?', 'What is a healthy meal, in your opinion?', 'What food from another country do you like?', 'How often do you eat out?', 'What do you usually have for a snack?'],
            B1: ['Should schools ban fast food and sweets? Why?', 'How have your eating habits changed over the years?', 'If you opened a restaurant, what would it serve?', 'Is it important for a family to eat together?', 'What is a dish that reminds you of your childhood?', 'Would you ever become a vegetarian? Why or why not?', 'Why do you think cooking shows are so popular?', 'What food could you never give up?'],
        },
        ask: ['Do you like …?', 'What do you eat for …?', 'Have you ever tried …?', 'Can you cook …?', 'What is your favourite …?'],
    },
    {
        id: 'school', title: 'School', emoji: '🏫',
        q: {
            A1: ['What is your favourite subject?', 'How do you go to school?', 'What is in your school bag?', 'Who sits next to you in class?', 'What do you do at break time?', 'What time does school start?', 'Do you like homework?', 'What subject is difficult for you?', 'What do you eat at school?', 'What is your classroom like?'],
            A2: ['What did you learn at school yesterday?', 'What is the best thing about your school?', 'What would you change about your school?', 'Who was your favourite teacher in primary school? Why?', 'How much homework do you get?', 'What is the funniest thing that has happened in class?', 'Which subject will be most useful in the future?', 'Do you prefer working alone or in a group?', 'What do you do when you don’t understand something?', 'What clubs or activities would you like at school?'],
            B1: ['Should students be able to choose all their subjects? Why?', 'Is homework necessary, in your opinion?', 'What makes a teacher a good teacher?', 'How could technology make school better?', 'Should school start later in the morning?', 'What is something school doesn’t teach but should?', 'Are exams the best way to see what students know?', 'What would your ideal school be like?'],
        },
        ask: ['What is your favourite …?', 'Do you like …?', 'What do you think about …?', 'How much … do you have?', 'Who is your …?'],
    },
    {
        id: 'family', title: 'Family & friends', emoji: '👨‍👩‍👧',
        q: {
            A1: ['Have you got any brothers or sisters?', 'Who is your best friend?', 'What is your mum or dad’s job?', 'Have you got a pet?', 'Who do you live with?', 'What does your best friend look like?', 'Who is the funniest person in your family?', 'How many cousins have you got?', 'What do you do with your family on Sundays?', 'Who is the oldest person in your family?'],
            A2: ['How did you meet your best friend?', 'What do you and your family do together?', 'Who do you talk to when you have a problem?', 'What makes someone a good friend?', 'Tell me about a person in your family you admire.', 'What do you argue about with your family?', 'What was the last thing you did with your friends?', 'Are you similar to your friends or different?', 'Who makes you laugh the most?', 'What jobs do you do at home?'],
            B1: ['Is it better to have a few close friends or lots of friends? Why?', 'How have your friendships changed as you’ve grown up?', 'What would you do if your best friend lied to you?', 'Can people be good friends online without ever meeting?', 'What have you learned from your grandparents?', 'Should parents know everything their children do online?', 'What is the most important thing in a friendship?', 'How are families today different from families in the past?'],
        },
        ask: ['Have you got …?', 'Who is your …?', 'What is your … like?', 'Do you and your … …?', 'How often do you see …?'],
    },
    {
        id: 'town', title: 'Home & town', emoji: '🏠',
        q: {
            A1: ['Where do you live?', 'What is your bedroom like?', 'What is your favourite place in your town?', 'Is there a park near your house?', 'What can you see from your window?', 'Do you live in a house or a flat?', 'What is your favourite room at home?', 'What shops are there in your street?', 'Is your town big or small?', 'Where do you go with your friends?'],
            A2: ['What is the best thing about where you live?', 'What would you show a visitor in your town?', 'What is missing in your neighbourhood?', 'Describe your perfect bedroom.', 'How has your town changed?', 'Would you prefer to live in a city or a village? Why?', 'What do young people do in your town?', 'Where did you live when you were younger?', 'What is the noisiest place in your town?', 'What is your favourite place to relax?'],
            B1: ['If you were the mayor, what would you change first?', 'What makes a place a good place to live?', 'Would you like to live in another country one day? Where?', 'How could your town be better for young people?', 'Are cities becoming better or worse places to live?', 'What is the difference between a house and a home?', 'Where will you live in twenty years, do you think?', 'Should cars be banned from city centres?'],
        },
        ask: ['Is there a … near …?', 'Where do you …?', 'What is your … like?', 'Do you live …?', 'What can you do in …?'],
    },
    {
        id: 'animals', title: 'Animals & nature', emoji: '🐾',
        q: {
            A1: ['What is your favourite animal?', 'Have you got a pet? What is its name?', 'Are you afraid of any animals?', 'Do you like cats or dogs more?', 'What animals can you see in your town?', 'What animal is very big?', 'What is your favourite animal at the zoo?', 'Do you like the beach or the mountains?', 'What animal can fly?', 'What do dogs eat?'],
            A2: ['If you could have any pet, what would you choose?', 'What is the most dangerous animal, in your opinion?', 'Have you ever seen a wild animal? Where?', 'What animal are you most like? Why?', 'What do you do to help nature?', 'What is the most beautiful place you have visited?', 'Would you like to work with animals?', 'Which animal would you like to be for one day?', 'What is the weather like in your favourite season?', 'What animals lived a long time ago?'],
            B1: ['Is it right to keep animals in zoos? Why or why not?', 'What can young people do to protect the environment?', 'Should people be allowed to keep wild animals as pets?', 'How will climate change affect your town?', 'Which animal do you think is the most intelligent? Why?', 'Would you give up meat to help the planet?', 'Why do people love pets so much?', 'What is the biggest environmental problem where you live?'],
        },
        ask: ['Have you got a …?', 'Do you like …?', 'Are you afraid of …?', 'What do … eat?', 'Have you ever seen a …?'],
    },
    {
        id: 'travel', title: 'Travel & holidays', emoji: '✈️',
        q: {
            A1: ['Where do you go in summer?', 'Do you like the beach?', 'How do you travel: by car, bus or train?', 'What do you take on holiday?', 'What country do you want to visit?', 'Do you like swimming in the sea?', 'Who do you go on holiday with?', 'What is your favourite holiday?', 'Do you like planes?', 'What do you do at the beach?'],
            A2: ['Where did you go on your last holiday?', 'What is the best trip you have ever had?', 'What do you always pack in your suitcase?', 'Would you prefer a holiday in the mountains or by the sea? Why?', 'What is the longest journey you have made?', 'What country would you like to visit and why?', 'Have you ever been abroad?', 'What do you like doing on holiday?', 'What went wrong on a trip you remember?', 'Do you prefer hotels or camping?'],
            B1: ['Is it better to travel with family or with friends? Why?', 'What can you learn from travelling that you can’t learn at school?', 'If you could live anywhere for a year, where would it be?', 'Does tourism help or harm a place?', 'What would you do on a trip with no money?', 'Would you travel to space if you had the chance?', 'What is the most interesting culture you know about?', 'How would you describe your country to a visitor?'],
        },
        ask: ['Have you ever been to …?', 'Where did you go …?', 'Would you like to visit …?', 'How do you travel to …?', 'What did you do in …?'],
    },
    {
        id: 'tech', title: 'Technology', emoji: '📱',
        q: {
            A1: ['Have you got a phone?', 'What games do you play on a phone or computer?', 'Do you watch videos? What videos?', 'Do you like taking photos?', 'What do you do on a computer?', 'Who do you send messages to?', 'Do you like robots?', 'Have you got a tablet at home?', 'What is your favourite app?', 'Do you play games online?'],
            A2: ['What apps do you use every day?', 'How old should children be to get a phone?', 'What did people do before the internet, do you think?', 'What is the best thing about the internet?', 'How many hours a day do you look at a screen?', 'What would you invent if you could?', 'Have you ever lost your phone or broken it?', 'Do you prefer texting or talking? Why?', 'What will phones be like in the future?', 'What do you use a computer for at school?'],
            B1: ['Could you live for a month without your phone? What would be hardest?', 'Is social media good or bad for young people?', 'Will robots do most jobs in the future?', 'How do you know if something online is true?', 'Should phones be allowed in class?', 'What is the most useful invention of all time, in your opinion?', 'How has technology changed friendship?', 'Would you trust a self-driving car?'],
        },
        ask: ['Have you got …?', 'Do you use …?', 'How often do you …?', 'What do you think about …?', 'What is your favourite …?'],
    },
    {
        id: 'past', title: 'Last weekend (past)', emoji: '⏪',
        q: {
            A1: ['What did you do yesterday?', 'What did you eat last night?', 'Where were you on Saturday?', 'Did you watch TV yesterday? What did you watch?', 'Who did you play with last weekend?', 'What time did you go to bed last night?', 'Did you go out on Sunday?', 'What did you do this morning?', 'Were you tired yesterday?', 'What did you have for breakfast today?'],
            A2: ['What was the best part of your last weekend?', 'What did you do last summer?', 'Tell me about your last birthday.', 'What was the last film you saw? Did you like it?', 'What did you do when you were five that you don’t do now?', 'What was the last thing you bought?', 'When did you last laugh a lot? What happened?', 'What games did you play when you were small?', 'What did you learn last week?', 'Where did you go the last time you went out with friends?'],
            B1: ['What is the most exciting thing that has ever happened to you?', 'Tell me about a time you were really surprised.', 'What was a mistake you learned something from?', 'What was your first day at this school like?', 'Describe a time when you helped someone.', 'What was the best present you have ever received?', 'Tell me about a time when everything went wrong.', 'What were you like when you were seven?'],
        },
        ask: ['What did you do …?', 'Did you …?', 'Where did you go …?', 'Who were you with …?', 'What was … like?'],
    },
    {
        id: 'future', title: 'Plans & future', emoji: '🔮',
        q: {
            A1: ['What are you going to do after school today?', 'What are you going to do this weekend?', 'What do you want to be?', 'What do you want for your birthday?', 'Where do you want to go next summer?', 'What are you going to eat tonight?', 'Who are you going to see this weekend?', 'What do you want to learn?', 'What are you going to watch tonight?', 'Do you want to have a pet in the future?'],
            A2: ['What are your plans for the next holidays?', 'What job would you like to do? Why?', 'Where will you live when you are an adult?', 'What are you going to do differently next year?', 'What will you do when you finish school?', 'What would you like to be able to do in five years?', 'What is one thing you want to do before you are 20?', 'Are you going to study or work after school?', 'What will your town be like in 2050?', 'What are you looking forward to?'],
            B1: ['What do you think your life will be like in fifteen years?', 'Which jobs will disappear in the future, and which will appear?', 'Would you like to be famous? Why or why not?', 'What will be the biggest change in the world in your lifetime?', 'What is one goal you have, and how will you reach it?', 'If you could know one thing about your future, what would you ask?', 'Is it better to plan your life or to see what happens?', 'How will schools be different in fifty years?'],
        },
        ask: ['What are you going to …?', 'Will you …?', 'Where do you want to …?', 'What would you like to …?', 'Are you going to …?'],
    },
    {
        id: 'imagine', title: 'Imagine…', emoji: '💭',
        q: {
            A1: ['You can have one superpower. What is it?', 'You have a magic bag. What is in it?', 'You are an animal for a day. Which animal?', 'You find 100 euros. What do you buy?', 'You can eat one food every day. What is it?', 'You have a robot. What does it do for you?', 'You can go anywhere today. Where do you go?', 'You can meet a famous person. Who?', 'You have a new pet dragon. What is its name?', 'Your house can be any colour. What colour?'],
            A2: ['If you could have any superpower, what would you choose and why?', 'If you had a time machine, where would you go?', 'If you were invisible for a day, what would you do?', 'If you could change one school rule, what would it be?', 'If you won a million euros, what would you do first?', 'If you could talk to animals, which animal would you talk to?', 'If you were the teacher today, what would the class do?', 'If you could live in a film or a game, which one would you choose?', 'If you could be any age for a week, how old would you be?', 'If you found a door to another world, would you go in?'],
            B1: ['If you could solve one world problem, which would you choose and how?', 'If you could have dinner with any three people, who would you invite?', 'What would happen if nobody needed to sleep?', 'If you had to live without one of your senses, which would you choose?', 'If you could send a message to yourself five years ago, what would you say?', 'What would the world be like without money?', 'If you could be the best in the world at one thing, what would it be?', 'If animals could vote, what laws would they want?'],
        },
        ask: ['What would you do if …?', 'If you could …, what …?', 'Would you like to …?', 'Why would you …?', 'What about you?'],
    },
    {
        id: 'opinions', title: 'Opinions', emoji: '🗣️',
        q: {
            A1: ['Are dogs better than cats? Why?', 'Is summer better than winter?', 'Is football boring or fun?', 'Is pizza the best food?', 'Is maths easy or difficult?', 'Is it good to get up early?', 'Are video games good?', 'Is rain nice?', 'Is English easy?', 'Are Mondays bad?'],
            A2: ['What is the best age to be? Why?', 'What is more important: being clever or being kind?', 'Is it better to be the oldest or the youngest child?', 'What is the most boring sport, in your opinion?', 'Should children get pocket money?', 'Is it better to live in a hot or a cold country?', 'What is the best invention ever?', 'Are films better than books?', 'What is the worst job in the world?', 'Should everyone learn to cook?'],
            B1: ['Do you think money can make people happy?', 'Should young people be allowed to vote at 16?', 'Is it ever OK to tell a lie?', 'Are famous people good role models?', 'Is competition good for people?', 'Should everyone do some volunteer work?', 'Is it more important to enjoy your job or to earn a lot?', 'Do we worry too much about how we look?'],
        },
        ask: ['What do you think about …?', 'Do you agree that …?', 'Why do you think …?', 'Is … better than …?', 'What is the best …?'],
    },
];

export const topicById = (id: string): Topic | undefined => TOPICS.find(topic => topic.id === id);

// Phrases that keep a conversation going, offered in every talk game.
export const KEEP_TALKING: Record<Level, string[]> = {
    A1: ['What about you?', 'Why?', 'Me too!', 'I like …', 'I don’t like …', 'Really?'],
    A2: ['What about you?', 'Why do you think that?', 'Me too, because …', 'I think … because …', 'Really? Tell me more.', 'I prefer …'],
    B1: ['What about you?', 'What makes you say that?', 'I see your point, but …', 'In my opinion, …', 'Could you give an example?', 'That’s interesting because …'],
};

// The questions for a table: the teacher's own, a topic's, or a mix of every topic.
export function questionsFor(topic: string, level: Level, custom: readonly string[]): { questions: string[]; ask: string[]; title: string; emoji: string } {
    if (topic === 'custom' && custom.length) return { questions: [...custom], ask: TOPICS[0].ask, title: 'Your teacher’s questions', emoji: '📝' };
    const one = topicById(topic);
    if (one) return { questions: one.q[level], ask: one.ask, title: one.title, emoji: one.emoji };
    return { questions: TOPICS.flatMap(item => item.q[level]), ask: ['What is your favourite …?', 'Do you like …?', 'Have you ever …?', 'What do you think about …?', 'How often do you …?'], title: 'Mix', emoji: '🎲' };
}
