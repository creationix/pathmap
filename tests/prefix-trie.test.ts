import { describe, it, expect } from 'bun:test';

import {
  encodePathMapLine,
  decodePathMapLine,
  PrefixTrie,
  PrefixTrieReader,
} from '../src/prefix-trie.ts';

describe('pathmap-line', () => {
  it('should encode correctly', () => {
    expect(encodePathMapLine([])).toEqual('');
    expect(encodePathMapLine(['hello', null, 'world', null])).toEqual(
      '/hello!/world!',
    );
    expect(encodePathMapLine([0, null, 0])).toEqual(':!:');
    expect(encodePathMapLine([10, null, 10])).toEqual(':a!:a');
    expect(encodePathMapLine([10, 20, 30, 40])).toEqual(':a:k:u:14');
    expect(encodePathMapLine(['fancy/paths', 'with\\slashes'])).toEqual(
      '/fancy\\/paths/with\\\\slashes',
    );
    expect(encodePathMapLine(['fancy:pants', 'paths!'])).toEqual(
      '/fancy\\:pants/paths\\!',
    );
  });

  it('should decode correctly', () => {
    expect(decodePathMapLine('/fancy\\/paths/with\\\\slashes\n')).toEqual([
      'fancy/paths',
      'with\\slashes',
    ]);
    expect(decodePathMapLine('\n!\n')).toEqual([]);
    expect(decodePathMapLine('!\n')).toEqual([null]);
    expect(() => decodePathMapLine('')).toThrowError();
    expect(() => decodePathMapLine('bad\n')).toThrowError();
    expect(decodePathMapLine('/hello/world\n')).toEqual(['hello', 'world']);
    expect(decodePathMapLine(':4!:5\n')).toEqual([4, null, 5]);
    expect(decodePathMapLine('/foo:a\n')).toEqual(['foo', 10]);
    expect(decodePathMapLine(':2i:28:1y:1o\n')).toEqual([90, 80, 70, 60]);
  });
});
describe('prefix-trie', () => {
  it('should insert and find values', () => {
    const writer = new PrefixTrie();
    writer.insert('/foo', { bar: 'baz' });
    expect(writer.find('/foo')).toEqual({ bar: 'baz' });
    expect(writer.find('/')).toBeUndefined();
    // console.log(writer.stringify(true));
    const reader = new PrefixTrieReader(writer.stringify());
    expect(reader.find('/foo')).toEqual({ bar: 'baz' });
    expect(reader.find('/')).toBeUndefined();
  });

  it('should round-trip basic shapes', () => {
    const writer = new PrefixTrie();
    const input = {
      '/foo': { path: 'foo' },
      '/foo/bar': true,
      '/foo/baz': false,
      '/foo/zag': null,
      '/foo/array': [1, 2, 3],
    };
    writer.bulkInsert(input);
    for (const [k, v] of Object.entries(input)) {
      expect(writer.find(k)).toEqual(v);
    }
    // console.log(writer.stringify(true));
    const reader = new PrefixTrieReader(writer.stringify());
    for (const [k, v] of Object.entries(input)) {
      expect(reader.find(k)).toEqual(v);
    }
  });

  it('should round trip all kinds of prefixes', () => {
    const writer = new PrefixTrie();
    const input = {
      '/': '/',
      '/2': '/',
      '/a': '/a',
      '/a/': '/a/',
      '/ab': '/ab',
      '/ab/': '/ab/',
      '/n': null,
      '/nu': null,
      '/nul': null,
      '/null': null,
      '/null/': null,
      '/null/v': null,
      '/null/va': null,
      '/null/val': null,
      '/null/valu': null,
      '/null/value': null,
      '/null/value/': null,
    };
    writer.bulkInsert(input);
    for (const [k, v] of Object.entries(input)) {
      expect(writer.find(k)).toEqual(v);
    }
    // console.log(writer.stringify(true));
    const reader = new PrefixTrieReader(writer.stringify());
    for (const [k, v] of Object.entries(input)) {
      expect(reader.find(k)).toEqual(v);
    }
  });

  it('should escape paths as needed', () => {
    const paths: string[][] = [
      ['fancy/path', 'with special'],
      ['fancy/characters', '<b>bold</b>', 'path'],
      ['c:\\\\Users', 'win32?'],
      ['exciting!', 'times!'],
    ];
    const input = Object.fromEntries(
      paths.map((path) => [
        `/${path.map((segment) => encodeURIComponent(segment)).join('/')}`,
        path,
      ]),
    );
    const writer = new PrefixTrie();
    writer.bulkInsert(input);
    // console.log(writer.stringify(true));
    for (const [k, v] of Object.entries(input)) {
      expect(writer.find(k)).toEqual(v);
    }

    const reader = new PrefixTrieReader(writer.stringify());
    for (const [k, v] of Object.entries(input)) {
      expect(reader.find(k)).toEqual(v);
    }
  });

  it('should round trip realistic data without deduplication', () => {
    const writer = new PrefixTrie();
    const input = {
      '/women/trousers/yoga-pants/black': 1,
      '/women/trousers/yoga-pants/blue': 2,
      '/women/trousers/yoga-pants/brown': 3,
      '/women/trousers/zip-off-trousers/blue': 4,
      '/women/trousers/zip-off-trousers/black': 5,
      '/women/trousers/zip-off-trousers/brown': 6,
    };
    writer.bulkInsert(input);
    for (const [k, v] of Object.entries(input)) {
      expect(writer.find(k)).toEqual(v);
    }
    // console.log(writer.stringify(true));
    expect(writer.stringify().length).toBeLessThan(120);
    const reader = new PrefixTrieReader(writer.stringify());
    for (const [k, v] of Object.entries(input)) {
      expect(reader.find(k)).toEqual(v);
    }
  });

  it('should round trip realistic data with deduplication', () => {
    const writer = new PrefixTrie();
    const input = {
      '/women/trousers/yoga-pants/black': 1,
      '/women/trousers/yoga-pants/blue': 2,
      '/women/trousers/yoga-pants/brown': 3,
      '/women/trousers/zip-off-trousers/blue': 2,
      '/women/trousers/zip-off-trousers/black': 1,
      '/women/trousers/zip-off-trousers/brown': 3,
    };
    writer.bulkInsert(input);
    for (const [k, v] of Object.entries(input)) {
      expect(writer.find(k)).toEqual(v);
    }
    // console.log(writer.stringify());
    expect(writer.stringify().length).toBeLessThan(90);
    const reader = new PrefixTrieReader(writer.stringify());
    for (const [k, v] of Object.entries(input)) {
      expect(reader.find(k)).toEqual(v);
    }
  });

  it('should round trip realistic data with all null values', () => {
    const writer = new PrefixTrie();
    const input = {
      '/women/trousers/yoga-pants/black': null,
      '/women/trousers/yoga-pants/blue': null,
      '/women/trousers/yoga-pants/brown': null,
      '/women/trousers/zip-off-trousers/blue': null,
      '/women/trousers/zip-off-trousers/black': null,
      '/women/trousers/zip-off-trousers/brown': null,
    };
    writer.bulkInsert(input);
    for (const [k, v] of Object.entries(input)) {
      expect(writer.find(k)).toEqual(v);
    }
    // console.log(writer.stringify());
    const reader = new PrefixTrieReader(writer.stringify());
    for (const [k, v] of Object.entries(input)) {
      expect(reader.find(k)).toEqual(v);
    }
  });

  it('should use byte offsets with unicode characters', () => {
    const writer = new PrefixTrie();
    const input = {
      '/poems/runes': 'ᚠᛇᚻ᛫ᛒᛦᚦ᛫ᚠᚱᚩᚠᚢᚱ᛫ᚠᛁᚱᚪ᛫ᚷᛖᚻᚹᛦᛚᚳᚢᛗ',
      '/poems/middle/english': 'An preost wes on leoden, Laȝamon was ihoten',
      '/poems/middle/deutsch': 'Sîne klâwen durh die wolken sint geslagen',
      '/poems/ελληνικά': 'Τη γλώσσα μου έδωσαν ελληνική',
      '/poems/русский': 'На берегу пустынных волн',
      '/poems/russian': 'На берегу пустынных волн',
      '/poems/ქართული': 'ვეპხის ტყაოსანი შოთა რუსთაველი',
      '/poems/georgian': 'ვეპხის ტყაოსანი შოთა რუსთაველი',
      '/poems/phonemic/𐐼𐐯𐑅𐐨𐑉𐐯𐐻':
        '𐐙𐐩𐑃 𐐺𐐨𐐮𐑍 𐑄 𐑁𐐲𐑉𐑅𐐻 𐐹𐑉𐐮𐑌𐑅𐐲𐐹𐐲𐑊 𐐮𐑌 𐑉𐐮𐑂𐐨𐑊𐐲𐐼 𐑉𐐮𐑊𐐮𐐾𐐲𐑌',
      '/poems/phonemic/deseret':
        '𐐙𐐩𐑃 𐐺𐐨𐐮𐑍 𐑄 𐑁𐐲𐑉𐑅𐐻 𐐹𐑉𐐮𐑌𐑅𐐲𐐹𐐲𐑊 𐐮𐑌 𐑉𐐮𐑂𐐨𐑊𐐲𐐼 𐑉𐐮𐑊𐐮𐐾𐐲𐑌',
      '/poems/phonemic/𐑖𐑱𐑝𐑰𐑩𐑯': '·𐑛𐑧𐑔 𐑦𐑥𐑐𐑤𐑲𐑟 𐑗𐑱𐑯𐑡 𐑯 𐑦𐑯𐑛𐑦𐑝𐑦𐑡𐑵𐑨𐑤𐑦𐑑𐑦;',
      '/poems/phonemic/shavian': '·𐑛𐑧𐑔 𐑦𐑥𐑐𐑤𐑲𐑟 𐑗𐑱𐑯𐑡 𐑯 𐑦𐑯𐑛𐑦𐑝𐑦𐑡𐑵𐑨𐑤𐑦𐑑𐑦;',
      '/emojis/smileys': '😂🫠😉☺️🥲😋🫣🤫🤔🫡',
      '/emojis/animals/mammals': '🐵🐒🦍🦧🐶🐕🦮🐕‍🦺🐩🐺🦊',
      '/emojis/animals/marine-animals': '🐳🐋🐬🦭🐟🐠🐡🦈🐙🐚🪸🪼',
      '/emojis/animals/insects-and-bugs': '🐌🦋🐛🐜🐝🪲🐞🦗🪳🕷️🕸️🦂🦟🪰🪱🦠',
      '/emojis/🌈': '🟥🟧🟨🟩🟦🟪',
      '/emojis/rainbow': '🟥🟧🟨🟩🟦🟪',
    };
    writer.bulkInsert(input);
    for (const [k, v] of Object.entries(input)) {
      expect(writer.find(k)).toEqual(v);
    }
    console.log('\nINPUT');
    console.log(input);
    console.log('\nOUTPUT');
    console.log(writer.stringify());
    expect(writer.stringify().length).toBe(770);
    const reader = new PrefixTrieReader(writer.stringify());
    for (const [k, v] of Object.entries(input)) {
      expect(reader.find(k)).toEqual(v);
    }
  });
});
