import * as path from 'path';
import * as fs from 'fs';
import { Project, SrcFile } from './Project';
import { mergeFiles } from './mergeFiles';

export function buildModel(options: { project: Project; qualifiedName: string }) {
    const { project, qualifiedName } = options;
    if (project.toBuild.has(qualifiedName)) {
        project.toBuild.delete(qualifiedName);
        project.models.delete(qualifiedName);
    }
    project.buildFailed.delete(qualifiedName);
    const { hash, srcFiles, resolveDir } = locateSrcFiles(project, qualifiedName);
    if (srcFiles.size === 0) {
        project.buildFailed.add(qualifiedName);
        throw new Error(`referenced ${qualifiedName} not found`);
    }
    let model = project.models.get(qualifiedName);
    if (model && model.hash === hash) {
        return model;
    }
    model = {
        hash,
        resolveDir,
        properties: [],
        staticProperties: [],
        methods: [],
        staticMethods: [],
        decorators: {},
        code: '',
        isTsx: false,
        tableName: '',
        qualifiedName
    }
    try {
        model = mergeFiles({ project, srcFiles, model });
        project.models.set(qualifiedName, model);
        return model;
    } catch(e) {
        project.buildFailed.add(qualifiedName);
        throw e;
    }
}

function locateSrcFiles(project: Project, qualifiedName: string) {
    const srcFiles = new Map<string, SrcFile>();
    let hash = 0;
    let resolveDir = '';
    for (const pkg of project.packages) {
        for (const ext of ['.ts', '.tsx', '.impl.ts', '.impl.tsx']) {
            const fileName = `${qualifiedName}${ext}`;
            const filePath = path.join(pkg.path, fileName);
            try {
                const stat = fs.lstatSync(filePath);
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