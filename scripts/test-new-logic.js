const dataSection = '51.1%48032,642.00171,209.6034017,790.7051,642.3000.0051,642.3061452.8%';

console.log('Data section:', dataSection);

// Budget
const budgetMatch = dataSection.match(/^([0-9.]+)%/);
const budget = parseFloat(budgetMatch[1]);
console.log('\nBudget:', budget + '%');

// Capacity - new pattern
const endMatch = dataSection.match(/(\d+)(\d\.\d+%|\d{2}\.\d+%)$/);
console.log('\nEnd match:', endMatch);
const capacity = parseFloat(endMatch[2].replace('%', ''));
const avail = parseInt(endMatch[1]);
console.log('Available:', avail);
console.log('Capacity:', capacity + '%');

// Middle
const middleStart = budgetMatch[0].length;
const middleEnd = dataSection.length - endMatch[0].length + endMatch[1].length;
const middleSection = dataSection.substring(middleStart, middleEnd);
console.log('\nMiddle section:', middleSection);

// Currencies - new regex with validation
const currencies = [];
const currencyRegex = /(?:\d{1,3}(?:,\d{3})+|\d{1,3})\.\d{2}/g;
let match;
while ((match = currencyRegex.exec(middleSection)) !== null) {
  const value = match[0];
  if (value.includes(',')) {
    const parts = value.split(',');
    const firstPart = parts[0];
    if (firstPart.length > 1 && firstPart[0] === '0') {
      console.log('Skipping invalid currency (leading zero):', value);
      continue;
    }
  }
  currencies.push({
    value: value,
    startIndex: match.index,
    endIndex: match.index + value.length
  });
}

console.log('\nCurrencies found:');
currencies.forEach((c, i) => {
  console.log(`  ${i}: "${c.value}" at ${c.startIndex}-${c.endIndex}`);
});

const fixedCount = parseInt(middleSection.substring(0, currencies[0].startIndex));
const fixedRev = parseFloat(currencies[0].value.replace(/,/g, ''));
const nonFixedCount = parseInt(middleSection.substring(currencies[0].endIndex, currencies[1].startIndex));
const nonFixedRev = parseFloat(currencies[1].value.replace(/,/g, ''));
const singleCount = parseInt(middleSection.substring(currencies[1].endIndex, currencies[2].startIndex));
const singleRev = parseFloat(currencies[2].value.replace(/,/g, ''));
const totalRev = parseFloat(currencies[5].value.replace(/,/g, ''));

console.log('\n✅ PARSED:');
console.log('Fixed:', fixedCount, 'tickets, $' + fixedRev.toLocaleString());
console.log('Non-fixed:', nonFixedCount, 'tickets, $' + nonFixedRev.toLocaleString());
console.log('Single:', singleCount, 'tickets, $' + singleRev.toLocaleString());
console.log('Total: $' + totalRev.toLocaleString());
console.log('Available:', avail, 'Capacity:', capacity + '%');

console.log('\n📊 EXPECTED:');
console.log('Fixed: 480 tickets, $32,642.00');
console.log('Non-fixed: 17 tickets, $1,209.60');
console.log('Single: 340 tickets, $17,790.70');
console.log('Total: $51,642.30');
console.log('Available: 614, Capacity: 52.8%');
