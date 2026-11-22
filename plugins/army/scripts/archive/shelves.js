'use strict';
/*
 * One entry per plugin whose local records The Archive can read. Each entry is a contract with that
 * plugin's file layout: when a plugin changes where it writes, change its entry here and its fixture test.
 *
 *   root     the plugin's state folder in the project
 *   sub      the folder under root that holds one folder per record (or, with flat, one file per record)
 *   files    fixed files directly under root, each one record (used instead of sub)
 *   title    [file, key]: the record's title is the "<key>: value" line of that file
 *   outcome  [file, key]: the record's outcome, read the same way
 *   json     [file, key]: the outcome is a top-level string field of a JSON file
 *   made     [file, word]: the outcome is <word> when that file exists
 *   live     true when the folder is current state, not history (indexed, but marked)
 */
module.exports = [
  { plugin: 'army', root: '.army', files: ['lessons.md', 'recon.md'] },
  { plugin: 'court', root: '.court', sub: 'cases', title: ['case.md', 'Question'], outcome: ['verdict.md', 'Ruling'] },
  { plugin: 'er', root: '.er', sub: 'charts' },
  { plugin: 'critics', root: '.critics', sub: 'tastings', outcome: ['review.md', 'Overall'] },
  { plugin: 'customs', root: '.customs', sub: 'reports', flat: true },
  { plugin: 'studio', root: '.studio', sub: 'productions', made: ['video.mp4', 'rendered'] },
  { plugin: 'atc', root: '.atc', files: ['airspace.json'], live: true },
  { plugin: 'mission-control', root: '.mission', sub: 'countdowns', outcome: ['ruling.md', 'Ruling'] },
  { plugin: 'academy', root: '.academy', sub: 'exams', json: ['results.json', 'grade'] },
  { plugin: 'newsroom', root: '.newsroom', sub: 'editions', made: ['release-notes.md', 'written'] },
  { plugin: 'premiere', root: '.premiere', sub: 'productions', made: ['film.mp4', 'rendered'] },
];
