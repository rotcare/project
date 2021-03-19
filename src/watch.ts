import { buildModel, Project } from '@rotcare/project';

/**
 * 监控本地磁盘文件，持续出发重新构建
 * @param project 要构建的项目
 * @param customizedBuild 每次项目文件被修改了，该回调会被调用
 */
export async function watch(project: Project, customizedBuild: () => Promise<void>) {
    let deploying: Promise<any> | undefined;
    let changedFiles: string[] = [];

    function build(project: Project, customizedBuild: () => Promise<void>, changedFile?: string) {
        if (deploying) {
            if (changedFile) {
                changedFiles.push(changedFile);
            }
            return;
        }
        if (changedFile) {
            console.log(`detected ${changedFile} changed, trigger re-deploying...`);
        }
        changedFiles.length = 0;
        const promises: Promise<any>[] = [
            customizedBuild().catch((e) => {
                console.error(`build failed`, e);
            }),
        ];
        for (const qualifiedName of project.toBuild) {
            if (!project.buildFailed.has(qualifiedName)) {
                promises.push(
                    buildModel({ project, qualifiedName }).catch((e) => {
                        console.error('buildModel failed', e);
                    }),
                );
            }
        }
        deploying = Promise.all(promises);
        deploying.finally(() => {
            deploying = undefined;
            if (changedFiles.length > 0 || project.toBuild.size > 0) {
                // some file changed during deploying
                build(project, customizedBuild);
            }
        });
        return;
    }

    project.startWatcher(build.bind(undefined, project, customizedBuild));
}
