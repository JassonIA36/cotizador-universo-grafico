const { execSync } = require('child_process');
const env = { ...process.env, PATH: 'C:\\Program Files\\Git\\cmd;' + (process.env.PATH || '') };

function run(cmd) {
  console.log('>', cmd);
  try {
    const out = execSync(cmd, { env, encoding: 'utf8' });
    if (out.trim()) console.log(out.trim());
  } catch (err) {
    console.error('Error running:', cmd, err.stderr || err.message);
    throw err;
  }
}

try {
  run('git init');
  run('git config user.name "JassonIA36"');
  run('git config user.email "jason@example.com"');
  run('git add .');
  try {
    run('git commit -m "Initial commit: Cotizador Universo Grafico con Cloudflare D1"');
  } catch(e) {
    console.log('Commit already created or no changes');
  }
  run('git branch -M main');
  try {
    run('git remote add origin https://github.com/JassonIA36/cotizador-universo-grafico.git');
  } catch (e) {
    run('git remote set-url origin https://github.com/JassonIA36/cotizador-universo-grafico.git');
  }
  run('git remote -v');
  console.log('Git repo successfully prepared!');
} catch (err) {
  process.exit(1);
}
