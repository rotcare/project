import * as path from 'path';
import { Project } from './Project';
import { locateSrcFiles } from './locateSrcFiles';
import * as babel from '@babel/types';
import { parse } from '@babel/parser';
import { mergeClassDecls } from './mergeClassDecls';
import { readModel } from './readModel';

export function buildModel(project: Project, qualifiedName: string) {
    const { cacheHash, srcFiles } = locateSrcFiles(project, qualifiedName);
    let model = project.models.get(qualifiedName);
    if (model === null) {
        return null;
    }
    if (model && model.cacheHash === cacheHash) {
        return model;
    }
    const classDecls: babel.ClassDeclaration[] = [];
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
        for (const stmt of ast.program.body) {
            if (
                babel.isExportNamedDeclaration(stmt) &&
                babel.isClassDeclaration(stmt.declaration) &&
                stmt.declaration.id.name === tableName
            ) {
                classDecls.push(stmt.declaration);
            }
        }
    }
    if (classDecls.length === 0) {
        project.models.set(qualifiedName, null);
        return null;
    }
    model = {
        cacheHash,
        tableName,
        qualifiedName,
        properties: [],
        staticProperties: [],
        methods: [],
        staticMethods: [],
        decorators: {},
    };
    readModel(mergeClassDecls(classDecls), model);
    project.models.set(qualifiedName, model);
    return model;
}
