import * as path from 'path';
import * as fs from 'fs';
import { parse } from '@babel/parser';
import * as babel from '@babel/types';
import generate from '@babel/generator';
import { BuildingModel, Project } from './Project';
import { mergeClassDecls } from './mergeClassDecls';
import { expandCodegen } from './expandCodegen';
import { fromObject } from 'convert-source-map';

export interface SrcFile {
    package: string;
    fileName: string;
    content: string;
}

export function mergeFiles(options: { project: Project; srcFiles: Map<string, SrcFile>, model: BuildingModel }) {
    const { project, srcFiles, model } = options;
    const imports: babel.ImportDeclaration[] = [];
    const beforeStmts: babel.Statement[] = [];
    const classDecls: babel.ClassDeclaration[] = [];
    const afterStmts: babel.Statement[] = [];
    const tableName = path.basename(model.qualifiedName);
    for (const [srcFilePath, srcFile] of srcFiles.entries()) {
        srcFile.content = srcFile.content || fs.readFileSync(srcFilePath).toString();
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
        extractStatements(tableName, ast, { imports, beforeStmts, afterStmts, classDecls });
    }
    const symbols = new Map<string, string>();
    const mergedStmts: babel.Statement[] = mergeImports({
        qualifiedName: model.qualifiedName,
        imports,
        symbols,
        project,
    });
    for (const stmt of beforeStmts) {
        try {
            mergedStmts.push(expandCodegen({ project, stmt, imports, symbols, qualifiedName: model.qualifiedName }));
        } catch (e) {
            console.error(`failed to generate code: ${(stmt.loc as any).filename}`, e);
            mergedStmts.push(stmt);
        }
    }
    if (classDecls.length > 0) {
        model.tableName = tableName;
        if (babel.isIdentifier(classDecls[0].superClass)) {
            model.archetype = classDecls[0].superClass.name;
        }
        const mergedClassDecl = mergeClassDecls({
            classDecls,
            model,
        });
        mergedStmts.push(babel.exportNamedDeclaration(mergedClassDecl, []));
    }
    for (const stmt of afterStmts) {
        try {
            mergedStmts.push(expandCodegen({ project, stmt, imports, symbols, qualifiedName: model.qualifiedName }));
        } catch (e) {
            console.error(`failed to generate code: ${(stmt.loc as any).filename}`, e);
            mergedStmts.push(stmt);
        }
    }
    const merged = babel.file(babel.program(mergedStmts, undefined, 'module'));
    const { code, map } = generate(merged, { sourceMaps: true }, {});
    if (!map) {
        throw new Error('missing map');
    }
    map.sourcesContent = [];
    for (const [i, srcFilePath] of map.sources.entries()) {
        if (srcFilePath.endsWith('.tsx')) {
            model.isTsx = true;
        }
        const srcFile = srcFiles.get(srcFilePath)!;
        map.sources[i] = `@motherboard/${srcFile.package}/${srcFile.fileName}`;
        map.sourcesContent.push(srcFile.content);
    }
    model.code = `${code}\n${fromObject(map).toComment()}`;
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
                project.toBuild.add(importQualifiedName);
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
