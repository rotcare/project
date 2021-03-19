#!/usr/bin/env node

let qualifiedName = process.argv[2];
if (!qualifiedName) {
    console.error('missing qualifiedName');
    process.exit(1);
}
const dotPos = qualifiedName.indexOf('.');
qualifiedName = dotPos === -1 ? qualifiedName : qualifiedName.substr(0, dotPos);

async function main() {
    const [warnings, modelCodes] = await require('@rotcare/project').buildModels(process.cwd(), [qualifiedName]);
    if (warnings) {
        for (const warning of warnings) {
            console.error(warning);
        }
        process.exit(1);
    }
    console.log(modelCodes[qualifiedName]);
}

main();