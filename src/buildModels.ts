import { buildModel, esbuildPlugin } from './buildModel';
import { Project } from './Project';
import * as esbuild from 'esbuild';

export async function buildModels(
    projectDir: string,
    toBuild: string[],
): Promise<[esbuild.Message[] | undefined, Record<string, string>]> {
    const project = new Project(projectDir);
    for (const qualifiedName of toBuild) {
        project.toBuild.add(qualifiedName);
    }
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
    const result = await esbuild.build({
        sourcemap: 'inline',
        keepNames: true,
        bundle: false,
        entryPoints: qualifiedNames.map((qualifiedName) => `@motherboard/${qualifiedName}`),
        platform: 'node',
        format: 'cjs',
        write: false,
        outdir: '/tmp',
        absWorkingDir: project.projectDir,
        plugins: [esbuildPlugin({ project })],
    });
    if (result.warnings.length > 0) {
        return [result.warnings, {}];
    }
    const modelCodes: Record<string, string> = {};
    for (const [i, outputFile] of result.outputFiles.entries()) {
        modelCodes[qualifiedNames[i]] = outputFile.text;
    }
    return [undefined, modelCodes];
}
