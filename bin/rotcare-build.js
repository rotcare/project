#!/usr/bin/env node

const projectDir = process.argv[2];
if (!projectDir) {
    console.error('missing projectDir');
    process.exit(1);
}
let qualifiedName = process.argv[3];
if (!qualifiedName) {
    console.error('missing qualifiedName');
    process.exit(1);
}
const dotPos = qualifiedName.indexOf('.');
qualifiedName = dotPos === -1 ? qualifiedName : qualifiedName.substr(0, dotPos);

async function main() {
    const [warnings, modelCodes] = await require('../index').transpileModels(projectDir, [qualifiedName]);
    if (warnings) {
        for (const warning of warnings) {
            console.error(warning);
        }
        process.exit(1);
    }
    console.log(JSON.stringify(modelCodes));
}

main();