var colors = require('colors');

console.log('First some yellow text'.yellow);

console.log('Underline that text'.yellow.underline);

console.log('Make it bold and red'.red.bold);

console.log(('Double Raindows All Day Long').rainbow);

console.log('Drop the bass'.trap);

console.log('DROP THE RAINBOW BASS'.trap.rainbow);

// styles not widely supported
console.log('Chains are also cool.'.bold.italic.underline.red);

// styles not widely supported
console.log('So '.green + 'are'.underline + ' ' + 'inverse'.inverse
  + ' styles! '.yellow.bold);
console.log('Zebras are so fun!'.zebra);

//
// Remark: .strikethrough may not work with Mac OS Terminal App
//
console.log('This is ' + 'not'.strikethrough + ' fun.');

console.log('Background color attack!'.black.bgWhite);
console.log('Use random styles on everything!'.random);
console.log('America, Heck Yeah!'.america);

console.log('Blindingly '.brightCyan + 'bright? '.brightRed + 'Why '.brightYellow + 'not?!'.brightGreen);

console.log('Setting themes is useful');

//
// Custom themes
//
console.log('Generic logging theme as JSON'.green.bold.underline);
// Load theme with JSON literal
colors.setTheme({
  silly: 'rainbow',
  input: 'grey',
  verbose: 'cyan',
  prompt: 'grey',
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red',
});

// outputs red text
console.log('this is an error'.error);

// outputs yellow text
console.log('this is a warning'.warn);

// outputs grey text
console.log('this is an input'.input);

console.log(('Wszystkie kolory tła').rainbow);
console.log(('Czarny').bgBlack);
console.log(('Czerwony').bgRed);
console.log(('Zielony').bgGreen);
console.log(('Żółty').bgYellow);
console.log(('Niebieski').bgBlue);
console.log(('Magenta').bgMagenta);
console.log(('Cyjanowy').bgCyan);
console.log(('Biały').bgWhite);

console.log(('Wszystkie kolory').rainbow);
console.log(('Czarny').black);
console.log(('Czerwony').red);
console.log(('Zielony').green);
console.log(('Żółty').yellow);
console.log(('Niebieski').blue);
console.log(('Magenta').magenta);
console.log(('Cyjanowy').cyan);
console.log(('Biały').white);
console.log(('Szary').gray);
