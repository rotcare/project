import { Project } from "./Project";
import * as path from 'path';
import * as fs from 'fs';

export function locateSrcFiles(project: Project, qualifiedName: string) {
    const srcFiles: Record<string, string> = {};
    let cacheHash = 0;
    const searchedPaths = [];
    for (const pkg of project.packages) {
        for (const ext of ['.ts', '.tsx', '.impl.ts', '.impl.tsx']) {
            const fileName = `${qualifiedName}${ext}`;
            const filePath = path.join(pkg.path, fileName);
            searchedPaths.push(filePath);
            try {
                const stat = fs.lstatSync(filePath);
                cacheHash += stat.mtimeMs;
                srcFiles[filePath] = fs.readFileSync(filePath).toString();
            } catch (e) {
                cacheHash += 1;
            }
        }
    }
    if (Object.keys(srcFiles).length === 0) {
        throw new Error(`referenced ${qualifiedName} not found in ${searchedPaths}`);
    }
    return { cacheHash, srcFiles };
}