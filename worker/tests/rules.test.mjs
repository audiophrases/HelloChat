// Seating the class: nobody alone, tables as close to the wanted size as the game allows, new partners each round.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chatProblem, sanitizeAvatar, seatStudents, tableSizes } from '../rules.ts';
import { levelOf, checkStyle } from '../../shared/levels.ts';

test('table sizes: nobody sits alone', () => {
    assert.deepEqual(tableSizes(5, 2, 2, 3), [3, 2]);
    assert.deepEqual(tableSizes(3, 2, 2, 3), [3]);
    assert.deepEqual(tableSizes(7, 3, 2, 4), [4, 3]);
    assert.deepEqual(tableSizes(6, 4, 3, 4), [3, 3]);
    assert.deepEqual(tableSizes(1, 2, 2, 3), []);
    assert.deepEqual(tableSizes(2, 4, 3, 4), []);
    for (let students = 2; students <= 35; students++) {
        for (const [want, min, max] of [[2, 2, 3], [2, 2, 4], [3, 2, 4], [4, 2, 4], [4, 3, 4]]) {
            const sizes = tableSizes(students, want, min, max);
            if (students < min) { assert.deepEqual(sizes, []); continue; }
            assert.equal(sizes.reduce((sum, size) => sum + size, 0), students, `${students} students all get a seat`);
            assert.ok(sizes.every(size => size >= min), `${students} students, tables of ${want}: ${sizes}`);
        }
    }
});

test('a new round seats students with new partners when it can', () => {
    const students = ['a', 'b', 'c', 'd', 'e', 'f'];
    const met = { a: ['b'], b: ['a'], c: ['d'], d: ['c'], e: ['f'], f: ['e'] };
    const tables = seatStudents(students, [2, 2, 2], met);
    assert.equal(tables.flat().length, 6);
    for (const [first, second] of tables) assert.ok(!met[first].includes(second), `${first} and ${second} have not met`);
});

test('the word filter and avatars', () => {
    assert.equal(chatProblem('I like pizza because it is good'), null);
    assert.ok(chatProblem('you are stupid'));
    assert.ok(chatProblem(''));
    assert.ok(chatProblem('x'.repeat(300)));
    assert.ok(sanitizeAvatar({ skin: 1, hairColor: 2, hair: 3, eyes: 4, mouth: 5, glasses: 0, shirt: 6, hat: 0 }));
    assert.equal(sanitizeAvatar({ skin: 99 }), null);
});

test('levels: the first comes fast, and looks need their level', () => {
    assert.equal(levelOf(7).level, 0);
    assert.equal(levelOf(8).level, 1);
    assert.equal(levelOf(20).level, 2);
    assert.equal(checkStyle({ colour: 2 }, 0), null);
    assert.deepEqual(checkStyle({ colour: 2 }, 1), { colour: 2, flair: null, bubble: 0, frame: 0 });
    assert.equal(checkStyle({ flair: '🐉' }, 1), null);
});
