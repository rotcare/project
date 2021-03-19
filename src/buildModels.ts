import { buildModel } from './buildModel';
import { Project } from './Project';

export async function buildModels(options: { project: Project }) {
    const { project } = options;
    const qualifiedNames: string[] = [];
    while (project.toBuild.size > 0) {
        const toBuild = [...project.toBuild];
        for (const qualifiedName of toBuild) {
            if (!qualifiedNames.includes(qualifiedName)) {
                qualifiedNames.push(qualifiedName);
            }
            await buildModel({ project, qualifiedName });
        }
    }
    return qualifiedNames;
}
