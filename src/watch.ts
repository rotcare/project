import { Project } from "./Project";

/**
 * 监控本地磁盘文件，持续出发重新构建
 * @param project 要构建的项目
 * @param builds 每次项目文件被修改了，该回调会被调用
 */
export function watch(project: Project, builds: Array<(project: Project) => Promise<void>>): void {
    let deploying: Promise<any> | undefined;
    let changedFiles: string[] = [];

    function onChange(changedFile?: string) {
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
        const promises: Promise<any>[] = [];
        for (const build of builds) {
            promises.push(
                build(project).catch((e) => {
                    console.error(`build failed`, e);
                }),
            );
        }
        deploying = Promise.all(promises);
        deploying.finally(() => {
            deploying = undefined;
            if (changedFiles.length > 0) {
                // some file changed during deploying
                onChange();
            }
        });
        return;
    }

    project.startWatcher(onChange);
}
