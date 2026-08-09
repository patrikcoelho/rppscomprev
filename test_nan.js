const parseVal = (v) => {
  const s = String(v || '0').trim();
  if (!s) return 0;
  const num = parseFloat(s.replace(',', '.'));
  return isNaN(num) ? 0 : num;
};

console.log(parseVal(" "));
console.log(parseVal(""));
console.log(parseVal("525.09"));
console.log(parseVal("525,09"));
console.log(parseFloat(" "));
