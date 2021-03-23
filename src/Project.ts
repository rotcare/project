import * as path from 'path';
import * as fs from 'fs';
import { Model } from '@rotcare/codegen';
import * as chokidar from 'chokidar';
import type { ProjectFile } from './ProjectFile';

/**
 * 代表了一个 TypeScript 项目。如果项目类型是 composite 则可能跨了多个 NPM 包，多个 Git 仓库。
 */
export class Project {
    /**
     * 项目的绝对路径
     */
    public readonly projectDir: string;
    /**
     * 在用 watch 构建的时候，通知 watch 要追加的订阅文件
     * @param filePath 要订阅的文件路径
     */
    public subscribePath = (filePath: string): void => {};
    /**
     * 项目的 npm 包名
     */
    public readonly projectPackageName: string;
    // 只有当项目文件包含一个和文件名同名的 class 的时候，这个文件才有一个 Model
    // @internal
    public readonly models = new Map<string, Model | null>();
    // @internal
    public readonly files = new Map<string, ProjectFile>();
    // @internal
    public readonly packages: { path: string; name: string }[] = [];
    private readonly knownPackageNames = new Set<string>();

    constructor(relProjectDir: string) {
        relProjectDir = relProjectDir || '.';
        this.projectDir = path.resolve(process.cwd(), relProjectDir);
        let packageJson: any;
        try {
            packageJson = require(`${this.projectDir}/package.json`);
        } catch (e) {
            throw `@rotcare/project requires valid package.json present in directory ${this.projectDir}: ${e}`;
        }
        this.projectPackageName = packageJson.name;
        const projectType = packageJson.rotcare?.project || 'solo';
        this.packages.push({ path: this.projectDir, name: this.projectPackageName });
        if (projectType === 'composite') {
            for (const pkg of Object.keys(packageJson.dependencies || {})) {
                try {
                    this.packages.push({
                        path: path.dirname(require.resolve(`${pkg}/package.json`)),
                        name: pkg,
                    });
                } catch(e) {
                    throw e;
                }
            }
        }
    }

    public startWatcher(onChange: (filePath?: string) => void) {
        const watcher = new chokidar.FSWatcher();
        watcher.on('all', (eventName, filePath) => onChange(filePath));
        this.subscribePath = watcher.add.bind(watcher);
        for (const pkg of this.packages) {
            this.subscribePath(pkg.path);
        }   
        onChange(undefined);
    }

    public subscribePackage(packageName: string) {
        if (this.knownPackageNames.has(packageName)) {
            return;
        }
        this.knownPackageNames.add(packageName);
        try {
            const pkgJsonPath = require.resolve(`${packageName}/package.json`);
            this.subscribePath(path.dirname(pkgJsonPath));
        } catch (e) {
            // ignore
        }
    }

    public listQualifiedNames(): string[] {
        const qualifiedNames = new Set<string>();
        for (const pkg of this.packages) {
            for (const srcFile of walk(pkg.path)) {
                const relPath = path.relative(pkg.path, srcFile);
                const dotPos = relPath.indexOf('.');
                const qualifiedName = relPath.substr(0, dotPos);
                qualifiedNames.add(qualifiedName);
            }
        }
        return Array.from(qualifiedNames);
    }
}

function* walk(filePath: string): Generator<string> {
    try {
        for (const dirent of fs.readdirSync(filePath)) {
            if (dirent.startsWith('.')) {
                continue;
            }
            yield* walk(path.join(filePath, dirent));
        }
    } catch (e) {
        const ext = path.extname(filePath);
        if (ext === '.tsx' || ext === '.ts') {
            yield filePath;
        }
    }
}