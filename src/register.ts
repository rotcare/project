import * as path from 'path';
import * as childProcess from 'child_process';
import * as fs from 'fs';

export function register() {
    const builtinModule = require('module');
    const Module = module.constructor.length > 1 ? module.constructor : builtinModule;
    const oldResolveFilename = Module._resolveFilename;
    Module._resolveFilename = function (
        request: any,
        parentModule: any,
        isMain: any,
        options: any,
    ) {
        if (request.startsWith('@motherboard/')) {
            return `${request}.ts`;
        }
        return oldResolveFilename.call(this, request, parentModule, isMain, options);
    };

    const projectDir = process.cwd();
    if (!fs.existsSync(path.join(projectDir, 'package.json'))) {
        console.error(
            'node -r @rotcare/project/register should be executed at the root of the project',
        );
        process.exit(1);
    }
    let requireExtensions: NodeJS.RequireExtensions;
    try {
        requireExtensions = require.extensions;
    } catch (e) {
        console.error('Could not register extension');
        throw e;
    }

    const origJsHandler = requireExtensions['.js'];
    const cache: Record<string, string> = {};

    const registerExtension = (ext: string) => {
        const origHandler = requireExtensions[ext] || origJsHandler;
        requireExtensions[ext] = function (module, filename) {
            if (filename.startsWith('@motherboard/')) {
                const qualifiedName = filename.replace('.ts', '').substr('@motherboard/'.length);
                if (!cache[qualifiedName]) {
                    const ret = childProcess
                        .spawnSync(process.argv0, [
                            `${__dirname}/../bin/rotcare-build.js`,
                            projectDir,
                            qualifiedName,
                        ]);
                    const stderr = ret.stderr.toString();
                    if (stderr) {
                        console.error(stderr);
                    }
                    const stdout = ret.stdout.toString();
                    if (stdout) {
                        const data = JSON.parse(stdout);
                        Object.assign(cache, data);
                    }
                }
                if (!cache[qualifiedName]) {
                    console.error(`build ${qualifiedName} failed`);
                    process.exit(1);
                }
                return (module as any)._compile(cache[qualifiedName], filename);
            }
            const relPath = path.relative(projectDir, filename);
            if (relPath[0] === '.') {
                return origHandler(module, filename);
            }
            const dotPos = relPath.indexOf('.');
            const qualifiedName = relPath.substr(0, dotPos);
            return (module as any)._compile(`require('@motherboard/${qualifiedName}')`, filename);
        };
    };

    registerExtension('.ts');
    registerExtension('.tsx');
}
