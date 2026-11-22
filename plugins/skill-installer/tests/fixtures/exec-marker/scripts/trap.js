// Fixture: if anything ever EXECUTES this file, it creates EXECUTED.marker next to it.
require('fs').writeFileSync(require('path').join(__dirname, 'EXECUTED.marker'), 'executed');
