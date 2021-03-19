import * as path from 'path';
import * as fs from 'fs';
import { parse } from '@babel/parser';
import * as babel from '@babel/types';
import generate from '@babel/generator';
import { fromObject } from 'convert-source-map';
import { Project } from './Project';
import { ModelMethod, ModelProperty } from '@rotcare/codegen';
import * as esbuild from 'esbuild';
import { mergeClassDecls } from './mergeClassDecls';
import { expandCodegen } from './expandCodegen';
import { promisify } from 'util';

const lstat = promisify(fs.lstat);
const readFile = promisify(fs.readFile);

interface SrcFile {
    package: string;
    fileName: string;
    content: string;
}

// @motherboard 开头的路径都是由这个 esbuildPlugin 虚构出来的
// 其源代码来自于 project 的多个 packages 合并而来
export function esbuildPlugin(options: { project: Project }): esbuild.Plugin {
    const { project } = options;
    return {
        name: 'rotcare',
        setup: (build) => {
            build.onResolve({ filter: /^[^.]/ }, (args) => {
                if (args.path.startsWith('@motherboard/')) {
                    return { path: args.path, namespace: '@motherboard' };
                } else {
                    project.subscribePackage(args.path);
                    return undefined;
                }
            });
            build.onLoad({ namespace: '@motherboard', filter: /^@motherboard\// }, async (args) => {
                const model = await buildModel({
                    project,
                    qualifiedName: args.path.substr('@motherboard/'.length),
                });
                return {
                    resolveDir: model.resolveDir,
                    contents: model.code,
                    loader: model.isTsx ? 'tsx' : 'ts',
                };
            });
        },
    };
}

export async function buildModel(options: { project: Project; qualifiedName: string }) {
    const { project, qualifiedName } = options;
    const { hash, srcFiles, resolveDir } = await locateSrcFiles(project.packages, qualifiedName);
    if (srcFiles.size === 0) {
        throw new Error(`referenced ${qualifiedName} not found`);
    }
    let model = project.models.get(qualifiedName);
    if (model && model.hash === hash) {
        if (!project.incompleteModels.has(model.qualifiedName)) {
            return model;
        }
    }
    project.incompleteModels.delete(qualifiedName);
    const imports: babel.ImportDeclaration[] = [];
    const beforeStmts: babel.Statement[] = [];
    const classDecls: babel.ClassDeclaration[] = [];
    const afterStmts: babel.Statement[] = [];
    const className = path.basename(qualifiedName);
    for (const [srcFilePath, srcFile] of srcFiles.entries()) {
        srcFile.content = (await readFile(srcFilePath)).toString();
        const ast = parse(srcFile.content, {
            plugins: [
                'typescript',
                'jsx',
                'classProperties',
                ['decorators', { decoratorsBeforeExport: true }],
            ],
            sourceType: 'module',
            sourceFilename: srcFilePath,
        });
        extractStatements(className, ast, { imports, beforeStmts, afterStmts, classDecls });
    }
    const symbols = new Map<string, string>();
    const mergedStmts: babel.Statement[] = mergeImports({
        qualifiedName,
        imports,
        symbols,
        project,
    });
    for (const stmt of beforeStmts) {
        try {
            mergedStmts.push(expandCodegen({ project, stmt, imports, symbols, qualifiedName }));
        } catch (e) {
            console.error(`failed to generate code: ${(stmt.loc as any).filename}`, e);
            mergedStmts.push(stmt);
        }
    }
    let archetype: string | undefined;
    const properties: ModelProperty[] = [];
    const staticProperties: ModelProperty[] = [];
    const methods: ModelMethod[] = [];
    const staticMethods: ModelMethod[] = [];
    if (classDecls.length > 0) {
        if (babel.isIdentifier(classDecls[0].superClass)) {
            archetype = classDecls[0].superClass.name;
        }
        const mergedClassDecl = mergeClassDecls({
            qualifiedName,
            classDecls,
            model: { properties, staticProperties, methods, staticMethods },
        });
        mergedStmts.push(babel.exportNamedDeclaration(mergedClassDecl, []));
    }
    for (const stmt of afterStmts) {
        try {
            mergedStmts.push(expandCodegen({ project, stmt, imports, symbols, qualifiedName }));
        } catch (e) {
            console.error(`failed to generate code: ${(stmt.loc as any).filename}`, e);
            mergedStmts.push(stmt);
        }
    }
    const merged = babel.file(babel.program(mergedStmts, undefined, 'module'));
    const { code, map } = generate(merged, { sourceMaps: true });
    if (!map) {
        throw new Error('missing map');
    }
    map.sourcesContent = [];
    let isTsx = false;
    for (const [i, srcFilePath] of map.sources.entries()) {
        if (srcFilePath.endsWith('.tsx')) {
            isTsx = true;
        }
        const srcFile = srcFiles.get(srcFilePath)!;
        map.sources[i] = `@motherboard/${srcFile.package}/${srcFile.fileName}`;
        map.sourcesContent.push(srcFile.content);
    }
    model = {
        qualifiedName,
        code: `${code}\n${fromObject(map).toComment()}`,
        hash,
        isTsx,
        resolveDir,
        archetype,
        properties,
        staticProperties,
        methods,
        staticMethods,
    };
    project.models.set(qualifiedName, model);
    return model;
}

function mergeImports(options: {
    project: Project;
    qualifiedName: string;
    imports: babel.ImportDeclaration[];
    symbols: Map<string, string>;
}) {
    const { project, qualifiedName, imports, symbols } = options;
    const merged: babel.ImportDeclaration[] = [];
    for (const stmt of imports) {
        // 通过替换了 import 路径，使得被 import 的文件仍然会交给这个插件来处理
        const isRelativeImport = stmt.source.value[0] === '.';
        if (isRelativeImport) {
            const importQualifiedName = path.join(path.dirname(qualifiedName), stmt.source.value);
            if (!project.models.has(importQualifiedName)) {
                project.incompleteModels.add(importQualifiedName);
            }
            stmt.source.value = `@motherboard/${importQualifiedName}`;
        }
        const specifiers = [];
        for (const specifier of stmt.specifiers) {
            if (symbols.has(specifier.local.name)) {
                continue;
            }
            symbols.set(specifier.local.name, stmt.source.value);
            specifiers.push(specifier);
        }
        if (specifiers.length) {
            merged.push({ ...stmt, specifiers });
        }
    }
    return merged;
}

async function locateSrcFiles(packages: { name: string; path: string }[], qualifiedName: string) {
    const srcFiles = new Map<string, SrcFile>();
    let hash = 0;
    let resolveDir = '';
    for (const pkg of packages) {
        for (const ext of ['.ts', '.tsx', '.impl.ts', '.impl.tsx']) {
            const fileName = `${qualifiedName}${ext}`;
            const filePath = path.join(pkg.path, fileName);
            try {
                const stat = await lstat(filePath);
                hash += stat.mtimeMs;
                srcFiles.set(filePath, { package: pkg.name, fileName, content: '' });
                if (!resolveDir) {
                    resolveDir = pkg.path;
                }
            } catch (e) {
                hash += 1;
            }
        }
    }
    return { hash, srcFiles, resolveDir } as const;
}

function extractStatements(
    className: string,
    ast: babel.File,
    extractTo: {
        imports: babel.ImportDeclaration[];
        beforeStmts: babel.Statement[];
        afterStmts: babel.Statement[];
        classDecls: babel.ClassDeclaration[];
    },
) {
    let found = false;
    for (const stmt of ast.program.body) {
        if (babel.isImportDeclaration(stmt)) {
            extractTo.imports.push(stmt);
        } else if (
            babel.isExportNamedDeclaration(stmt) &&
            babel.isClassDeclaration(stmt.declaration) &&
            stmt.declaration.id.name === className
        ) {
            found = true;
            extractTo.classDecls.push(stmt.declaration);
        } else {
            if (found) {
                extractTo.afterStmts.push(stmt);
            } else {
                extractTo.beforeStmts.push(stmt);
            }
        }
    }
}
