import * as path from 'path';
import { parse } from '@babel/parser';
import * as babel from '@babel/types';
import * as babelCore from '@babel/core';
import { Project } from './Project';
import { mergeClassDecls } from './mergeClassDecls';
import { expandCodegen } from './expandCodegen';
import { fromObject } from 'convert-source-map';

export function buildFileCode(project: Project, qualifiedName: string, srcFiles: Record<string, string>) {
    const imports: babel.ImportDeclaration[] = [];
    const beforeStmts: babel.Statement[] = [];
    const classDecls: babel.ClassDeclaration[] = [];
    const afterStmts: babel.Statement[] = [];
    const tableName = path.basename(qualifiedName);
    for (const [srcFilePath, srcFile] of Object.entries(srcFiles)) {
        const ast = parse(srcFile, {
            plugins: [
                'typescript',
                'jsx',
                'classProperties',
                ['decorators', { decoratorsBeforeExport: true }],
            ],
            sourceType: 'module',
            sourceFilename: srcFilePath,
        });
        extractStatements(tableName, ast, { imports, beforeStmts, afterStmts, classDecls });
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
            mergedStmts.push(expandCodegen({ project, stmt, imports, symbols }));
        } catch (e) {
            console.error(`failed to generate code: ${(stmt.loc as any).filename}`, e);
            mergedStmts.push(stmt);
        }
    }
    if (classDecls.length > 0) {
        const mergedClassDecl = mergeClassDecls(classDecls);
        mergedStmts.push(babel.exportNamedDeclaration(mergedClassDecl, []));
    }
    for (const stmt of afterStmts) {
        try {
            mergedStmts.push(expandCodegen({ project, stmt, imports, symbols }));
        } catch (e) {
            console.error(`failed to generate code: ${(stmt.loc as any).filename}`, e);
            mergedStmts.push(stmt);
        }
    }
    const merged = babel.file(babel.program(mergedStmts, undefined, 'module'));
    const result = babelCore.transformFromAstSync(merged, undefined, {
        sourceMaps: true,
        plugins: [
            '@babel/plugin-transform-typescript',
            '@babel/plugin-transform-modules-commonjs',
            '@babel/plugin-transform-react-jsx',
        ],
    });
    if (!result || !result.code || !result.map) {
        throw new Error('transform typescript failed');
    }
    result.map.sourcesContent = [];
    result.map.sourcesContent.length = result.map.sources.length;
    for (const [i, srcFilePath] of result.map.sources.entries()) {
        result.map.sourcesContent[i] = srcFiles[srcFilePath];
    }
    return `${result.code}\n${fromObject(result.map).toComment()}`;
}

function mergeImports(options: {
    project: Project;
    qualifiedName: string;
    imports: babel.ImportDeclaration[];
    symbols: Map<string, string>;
}) {
    const { qualifiedName, imports, symbols } = options;
    const merged: babel.ImportDeclaration[] = [];
    for (const stmt of imports) {
        // 通过替换了 import 路径，使得被 import 的文件仍然会交给这个插件来处理
        const isRelativeImport = stmt.source.value[0] === '.';
        if (isRelativeImport) {
            const importQualifiedName = path.join(path.dirname(qualifiedName), stmt.source.value);
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

function extractStatements(
    tableName: string,
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
            stmt.declaration.id.name === tableName
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
