require('ts-eager/register');

Object.assign(module.exports, require('./src/register'));
Object.assign(module.exports, require('./src/Project'));
Object.assign(module.exports, require('./src/buildModel'));
Object.assign(module.exports, require('./src/buildModels'));
Object.assign(module.exports, require('./src/transpileModels'));
Object.assign(module.exports, require('./src/watch'));