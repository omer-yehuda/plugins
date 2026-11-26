'use strict';
const phrases = { english: 'Hello!', french: 'Bonjour!', spanish: 'Hola!' };
const lang = (process.argv[2] || 'english').toLowerCase();
process.stdout.write((phrases[lang] || phrases.english) + '\n');
