import { Project } from './Project';
import { locateSrcFiles } from './locateSrcFiles';
import { buildFileCode } from './buildFileCode';

/**
 * 构建项目中的指定 TypeScript 文件为 JavaScript
 * @param project 项目对象
 * @param qualifiedName TypeScript 文件相对项目目录的路径，不含扩展名
 * @returns 构建出来的 JavaScript
 */
export function buildFile(project: Project, qualifiedName: string): string {
    const { cacheHash, srcFiles } = locateSrcFiles(project, qualifiedName);
    let projectFile = project.files.get(qualifiedName);
    if (projectFile && projectFile.cacheHash === cacheHash) {
        return projectFile.code;
    }
    projectFile = {
        cacheHash,
        code: buildFileCode(project, qualifiedName, srcFiles)
    }
    project.files.set(qualifiedName, projectFile);
    return projectFile.code;
}
