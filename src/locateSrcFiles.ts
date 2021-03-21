import { Project } from "./Project";
import * as path from 'path';
import * as fs from 'fs';

export function locateSrcFiles(project: Project, qualifiedName: string) {
    const srcFiles: Record<string, string> = {};
    let cacheHash = 0;
    let resolveDir = '';
    let isTsx = false;
    for (const pkg of project.packages) {
        for (const ext of ['.ts', '.tsx', '.impl.ts', '.impl.tsx']) {
            const fileName = `${qualifiedName}${ext}`;
            const filePath = path.join(pkg.path, fileName);
            try {
                const stat = fs.lstatSync(filePath);
                cacheHash += stat.mtimeMs;
                srcFiles[filePath] = fs.readFileSync(filePath).toString();
                if (!resolveDir) {
                    resolveDir = pkg.path;
                }
                if (ext === '.tsx' || ext === '.impl.tsx') {
                    isTsx = true;
                }
            } catch (e) {
                cacheHash += 1;
            }
        }
    }
    return { cacheHash, srcFiles, resolveDir, isTsx };
}