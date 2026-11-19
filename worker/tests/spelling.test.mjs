// The chat box's English check: names of films, games, singers and places get through, words from home, first
// names on their own and names thrown as insults do not.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createChecker } from '../../src/spelling.ts';
import { PROPER_NOUNS, PROPER_PHRASES, properName } from '../../shared/properNouns.ts';
import { HOME_WORDS } from '../../shared/chatWords.ts';
import { insultIn, localHarm, slurIn } from '../../shared/safety.ts';

const modules = path.join(import.meta.dirname, '..', '..', 'node_modules');
const read = file => fs.readFileSync(path.join(modules, file), 'utf8');
const check = createChecker(read('dictionary-en/index.aff'), read('dictionary-en/index.dic'), { aff: read('dictionary-en-gb/index.aff'), dic: read('dictionary-en-gb/index.dic') });
const stopped = (text, names) => check(text, names).map(item => item.word.toLowerCase());

test('names of films, games, singers, footballers and places get through', () => {
    for (const text of [
        'i love christmas and halloween', 'do you have a tv or a pc', 'i play gta and valorant on my pc', 'my favourite singer is billie eilish',
        'i like camila cabello', 'i live in el vendrell near coma-ruga', 'we watched spiderman and shrek', 'messi and lamine yamal play for barça',
        'Where do you want to study after ESO?', 'i speak english and chinese', 'Grand Theft Auto: San Andreas is old', 'i want to be an influencer',
    ]) assert.deepEqual(stopped(text), [], text);
});

test('a first name alone, a word from home and a lower-case ESO are still stopped', () => {
    assert.deepEqual(stopped('billie is cool'), ['billie'], 'a first name only works in the full name');
    assert.deepEqual(stopped('i like cabello'), ['cabello'], '"hair" in Spanish');
    assert.deepEqual(stopped('i like mario'), ['mario']);
    assert.deepEqual(stopped('i like super mario'), []);
    assert.deepEqual(stopped('after eso'), ['eso'], '"that" in Spanish');
    for (const word of ['que', 'de', 'si', 'pixar', 'encanto', 'terrassa', 'barca', 'cristiano', 'nadal']) assert.deepEqual(stopped(`i ${word} it`), [word], word);
    // With secret names on, real names are not in the list: they stay stopped.
    assert.deepEqual(stopped('i like laura'), ['laura']);
    assert.deepEqual(stopped('i like laura', ['Laura Pérez']), [], 'a classmate’s name is fine when names are shown');
    assert.deepEqual(stopped('i like encanto', ['Encanto']), [], 'a word the teacher allowed');
});

test('names thrown as insults are stopped, flagged and never suggested', () => {
    for (const text of ['ok jeffrey epstein', 'ok Diddy', 'you are H1tler', 'the son of saddam', 'bin laden']) {
        assert.ok(check(text).some(item => item.banned && !item.suggestions.length), text);
        assert.equal(localHarm(text), 'harassment', text);
    }
    assert.equal(insultIn('I love my diddy dog'), 'diddy');
    assert.equal(insultIn('a bin in the garden'), null);
    for (const item of check('ok epstien and hitlr')) assert.ok(!item.suggestions.some(word => insultIn(word)), `no insult suggested for ${item.word}`);
});

test('a name typed nearly right is offered as written', () => {
    const first = text => check(text)[0]?.suggestions[0];
    assert.equal(first('i play fornite'), 'Fortnite');
    assert.equal(first('my miencraft world'), 'Minecraft');
    // As close as a dictionary word ("stein"): offered too, after it, as "mony" offers money before Sony.
    assert.ok(check('have you been to spein')[0].suggestions.slice(0, 2).includes('Spain'));
    assert.equal(first('i love the barca'), 'Barça');
    assert.equal(first('i watch spaiderman'), 'Spiderman');
});

test('the lists: every name and its written form pass, and none is a word from home or an insult', () => {
    for (const entry of PROPER_NOUNS) {
        assert.equal(entry, entry.toLowerCase(), entry);
        assert.ok(!HOME_WORDS[entry], `${entry} is a word from home`);
        assert.ok(!slurIn(entry) && !insultIn(entry), entry);
        assert.deepEqual(stopped(properName(entry)), [], `${entry} is suggested as "${properName(entry)}", which must pass`);
    }
    for (const phrase of PROPER_PHRASES) assert.deepEqual(stopped(phrase), [], phrase);
});
