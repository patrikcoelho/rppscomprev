const fs = require('fs');
let servers = JSON.parse(fs.readFileSync('initial_servers.json', 'utf8'));
const cutoff = new Date('2005-01-18T00:00:00Z');

servers = servers.map(s => {
  const dateObj = new Date(s.entryDate + 'T00:00:00Z');
  const fund = (dateObj <= cutoff) ? 'FUNDO_FINANCEIRO' : 'FUNDO_PREVIDENCIARIO';
  return { ...s, fund };
});

fs.writeFileSync('initial_servers.json', JSON.stringify(servers, null, 2));
