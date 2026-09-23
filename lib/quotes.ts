/**
 * Quotes for the entry screen. Each is traced to a specific work: popular
 * "philosopher quotes" are frequently misattributed, so none is included
 * without a source. Translations are the standard English ones named.
 */

export interface Quote {
  text: string;
  author: string;
  source: string;
}

export const QUOTES: Quote[] = [
  {
    text: 'There have been as many plagues as wars in history; yet always plagues and wars take people equally by surprise.',
    author: 'Albert Camus',
    source: 'The Plague (1947), tr. Stuart Gilbert',
  },
  {
    text: 'The evil that is in the world almost always comes of ignorance, and good intentions may do as much harm as malevolence if they lack understanding.',
    author: 'Albert Camus',
    source: 'The Plague (1947), tr. Stuart Gilbert',
  },
  {
    text: 'The only means of fighting a plague is common decency.',
    author: 'Albert Camus',
    source: 'The Plague (1947), tr. Stuart Gilbert',
  },
  {
    text: 'A wise man proportions his belief to the evidence.',
    author: 'David Hume',
    source: 'An Enquiry Concerning Human Understanding (1748), §10',
  },
  {
    text: 'When you know a thing, to hold that you know it; and when you do not know a thing, to allow that you do not know it; this is knowledge.',
    author: 'Confucius',
    source: 'Analects 2.17, tr. James Legge',
  },
  {
    text: 'All men by nature desire to know.',
    author: 'Aristotle',
    source: 'Metaphysics, Book I, tr. W. D. Ross',
  },
  {
    text: 'Have courage to use your own understanding.',
    author: 'Immanuel Kant',
    source: 'An Answer to the Question: What Is Enlightenment? (1784)',
  },
  {
    text: 'It is not enough to have a good mind; the main thing is to use it well.',
    author: 'René Descartes',
    source: 'Discourse on the Method (1637), Part I',
  },
  {
    text: 'He who knows only his own side of the case knows little of that.',
    author: 'John Stuart Mill',
    source: 'On Liberty (1859), ch. 2',
  },
  {
    text: 'Knowledge itself is power.',
    author: 'Francis Bacon',
    source: 'Meditationes Sacrae (1597)',
  },
  {
    text: 'All things excellent are as difficult as they are rare.',
    author: 'Baruch Spinoza',
    source: 'Ethics (1677), Part V, tr. R. H. M. Elwes',
  },
  {
    text: 'While we are postponing, life speeds by.',
    author: 'Seneca',
    source: 'Letters to Lucilius, Letter I, tr. R. M. Gummere',
  },
];
