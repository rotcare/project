import * as path from 'path';
import { Project } from './Project';
import { locateSrcFiles } from './locateSrcFiles';
import * as babel from '@babel/types';
import { parse } from '@babel/parser';
import { mergeClassDecls } from './mergeClassDecls';
import { readModel } from './readModel';
import { Model } from '@rotcare/codegen';

/**
 * 抽象项目指定 TypeScript 文件中和文件同名的 Class 定义为 Model 对象。
 * 比如文件名为 Home/Ui/HomePage.ts 那么抽取的类就必须定义在这个文件中，且名字为 HomePage
 * @param project 项目对象
 * @param qualifiedName TypeScript 文件相对项目目录的路径，不含扩展名
 * @returns 描述了 Class 定义的 Model 对象，包含属性列表，方法列表这些
 */
export function buildModel(project: Project, qualifiedName: string): Model | null {
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
