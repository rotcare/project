import { Project } from './Project';
import { locateSrcFiles } from './locateSrcFiles';
import { buildFileCode } from './buildFileCode';

export function buildFile(project: Project, qualifiedName: string) {
    const { cacheHash, srcFiles, isTsx, resolveDir } = locateSrcFiles(project, qualifiedName);
    let projectFile = project.files.get(qualifiedName);
    if (projectFile && projectFile.cacheHash === cacheHash) {
        return projectFile;
    }
    projectFile = {
        cacheHash,
        isTsx,
        resolveDir,
        code: buildFileCode(project, qualifiedName, srcFiles)
    }
    return projectFile;
}
