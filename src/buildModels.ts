import { buildModel } from './buildModel';
import { Project } from './Project';

export function buildModels(options: { project: Project }) {
    const { project } = options;
    const qualifiedNames: string[] = [];
    while (project.toBuild.size > 0) {
        for (const qualifiedName of [...project.toBuild]) {
            if (!qualifiedNames.includes(qualifiedName)) {
                qualifiedNames.push(qualifiedName);
            }
            buildModel({ project, qualifiedName });
        }
    }
    return qualifiedNames;
}
