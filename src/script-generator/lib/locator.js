import path from 'path';
import fs from 'fs';
import deep from 'deep-extend';

const child = require("child_process");

export default class Locator {
    constructor(options, DEFAULTS) {
        // upadte all parent classes with the options inherited
        this.options = deep(DEFAULTS, options);
        this.lsCache = {};
    }

    msBuildFromWhere(pathRoot, findAll) {
        findAll = findAll || false;
        const vsWherePath = path.join(pathRoot, "Microsoft Visual Studio", "Installer", "vswhere.exe");
        if (!fs.existsSync(vsWherePath)) {
            // no vswhere -- fall back on manual methods
            return [];
        }
        let args = findAll ? [] : ["-latest"];
        args = args.concat(["-products", "*", "-requires", "Microsoft.Component.MSBuild"]);
        const whereProcess = child.spawnSync(
            vsWherePath,
            args, {
                cwd: process.cwd(),
                env: process.env,
                stdio: "pipe",
                encoding: "utf-8"
            }
        );

        if (whereProcess.output === null) {
            return [];
        }
        let cmdOutput = "";
        if (whereProcess.output.length > 0) {
            for (let index = 0; index < whereProcess.output.length; index++) {
                cmdOutput = whereProcess.output[index] || "";
                if (cmdOutput.length > 0) {
                    break;
                }
            }
        }
        const installKeyword = "installationPath";
        const installationVersionKeyword = "installationVersion";
        const all = [];
        if (cmdOutput.length > 0) {
            let installationPath, installationVersion;

            const results = cmdOutput.split(/\r?\n/);
            for (let cmdLineIndex = 0; cmdLineIndex < results.length; cmdLineIndex++) {
                const cmdLine = results[cmdLineIndex];
                if (cmdLine.startsWith(installKeyword)) {
                    installationPath = cmdLine.replace(installKeyword + ": ", "");
                }

                if (cmdLine.startsWith(installationVersionKeyword)) {
                    let versionParts = cmdLine.replace(installationVersionKeyword + ": ", "").split(".");
                    if (versionParts.length > 0) {
                        installationVersion = parseFloat(versionParts[0]);
                    }
                }
                if (installationPath && installationVersion) {
                    all.push({
                        installationPath,
                        installationVersion
                    });
                    installationPath = undefined;
                    installationVersion = undefined;
                }
            }

        }

        all.sort((a, b) => a.installationVersion - b.installationVersion);
        if (findAll) {
            return all.map(o => [o.installationPath, o.installationVersion]);
        } else {
            const highest = all[all.length - 1];
            if (highest === undefined) {
                return [];
            }
            return [highest.installationPath, highest.installationVersion];
        }
    }

    findWindirMsBuildFor(is64Bit, toolsVersion, windir) {
        windir = windir || process.env.WINDIR;
        if (!windir) {
            return []; // can't look when we don't know where
        }
        const framework = is64Bit ? "Framework64" : "Framework";
        const baseDir = path.join(windir, "Microsoft.NET", framework);
        const frameworkVersions = fs.readdirSync(baseDir)
            .filter(p => isDir(path.join(baseDir, p)))
            .map(p => p.replace(/^v/, "")) // strip leading 'v'
            .map(p => parseFloat(p))
            .filter(version => !isNaN(version));
        const match = frameworkVersions.find(
            ver => ver.toFixed(1) === toolsVersion.toFixed(1)
        );
        if (!match) {
            throw new Error(`No or invalid MSBuild version was supplied! (Can't find msbuild for toolsVersion under ${baseDir} (perhaps override windir?))`);
        }
        return path.join(baseDir, `v${match}`, "MSBuild.exe");
    }

    /**
     * @function
     * @name detectMsBuild15Dir
     * @description - Will try to find the 2017 visual studio path.
     * @param {[String]} [pathRoot] The root directory fir visual studio.
     * @returns {[String]} A path containing the msbuilddir or undefined if not found.
     */

    detectMsBuild15Dir(pathRoot) {
        const vs2017Path = path.join(pathRoot, 'Microsoft Visual Studio', '2017'),
            possibleFolders = ['BuildTools', 'Enterprise', 'Professional', 'Community'];
        for (const possibleFolder of possibleFolders) {
            try {
                const folderPath = path.join(vs2017Path, possibleFolder);
                fs.statSync(folderPath);
                return folderPath;
            } catch (e) {}
        }
    }

    addDetectedMsBuildVersionsToConstantsLookup(executables) {
        return executables.map(exe => {
                try {
                    const proc = child.spawnSync(exe, ["/version"], {
                        encoding: "utf8"
                    });
                    const lines = proc.stdout.split(os.EOL);
                    const thisVersion = lines[lines.length - 1];
                    const verParts = thisVersion.split(".");
                    const major = verParts[0];
                    const shortVer = `${major}.0`; // not technically correct: I see msbuild 16.1 on my machine, but keeps in line with prior versioning
                    const ver = parseFloat(shortVer);
                    if (!this.constants.MSBUILD_VERSIONS[shortVer]) {
                        this.constants.MSBUILD_VERSIONS[ver] = shortVer;
                        return ver;
                    }
                } catch (e) {
                    console.warn(`Unable to query version of ${exe}: ${e}`);
                }
            })
            .filter(ver => !!ver)
            .reduce((acc, cur) => {
                if (acc.indexOf(cur) === -1) {
                    acc.push(cur);
                }
                return acc;
            }, [])
            .sort()
            .reverse();
    }


    /**
     * @function
     * @name autoDetectVersion
     * @description - Will attempt to find the visual studio exe location.
     * @param {[String]} [pathRoot] The root directory for visual studio.
     * @returns {[String]} A path containing the msbuilddir or undefined if not found.
     */

    autoDetectVersion(pathRoot, matchVersion) {
        // Try to detect using fromWhere
        const findAll = matchVersion !== undefined;
        const wherePath = this.msBuildFromWhere(pathRoot, findAll);
        if (wherePath.length > 0) {
            if (findAll) {
                for (const pair of wherePath) {
                    const [_, version] = pair;
                    if (version === matchVersion) {
                        return pair;
                    }
                }
            } else {
                return wherePath;
            }
        }

        if (matchVersion >= 15.0) {
            // Try to detect MSBuild 15.0.
            const msbuild15OrLaterDir = detectMsBuild15Dir(pathRoot);
            if (msbuild15OrLaterDir) {
                const msbuildHome = path.join(msbuild15OrLaterDir, "MSBuild");
                const msbuildExecutables = this.findMSBuildExeUnder(msbuildHome);
                const detected = this.addDetectedMsBuildVersionsToConstantsLookup(msbuildExecutables);
                return [msbuild15OrLaterDir, detected[0] || 15.0];
            }
        }

        // Detect MSBuild lower than 15.0.
        // ported from https://github.com/stevewillcock/grunt-msbuild/blob/master/tasks/msbuild.js#L167-L181
        const msbuildDir = path.join(pathRoot, 'MSBuild');
        let msbuildDirExists = true;
        try {
            fs.statSync(msbuildDir);
        } catch (e) {
            msbuildDirExists = false;
        }
        if (!msbuildDirExists) return [pathRoot, 4.0];
        const msbuildVersions = fs.readdirSync(msbuildDir)
            .filter(entryName => {
                let binDirExists = true;
                const binDirPath = path.join(msbuildDir, entryName, 'Bin');
                try {
                    fs.statSync(binDirPath);
                } catch (e) {
                    binDirExists = false;
                }
                return entryName.indexOf('1') === 0 && binDirExists;
            });
        // Return latest installed msbuild version
        if (msbuildVersions.length > 0) return [pathRoot, parseFloat(msbuildVersions.pop())];
    }

    lsR(folder) {
        if (lsCache[folder]) {
            return lsCache[folder];
        }
        return lsCache[folder] = fs.readdirSync(folder)
            .reduce((acc, cur) => {
                const fullPath = path.join(folder, cur);
                const st = fs.statSync(fullPath);
                if (st.isFile()) {
                    acc.push(fullPath);
                    return acc;
                }
                return acc.concat(lsR(fullPath));
            }, []);
    }


    findMSBuildExeUnder(folder) {
        return lsR(folder).filter(fpath => {
            const fileName = path.basename(fpath);
            return fileName.toLowerCase() === "msbuild.exe";
        });
    }

    /**
     * @function
     * @name locate
     * @description - Will attempt to find the visual studio exe location.
     * @param {[String]} [options] - The options object for the msbuild, it should contain the platform, architecure etc.
     * @returns {[String]} A path containing the msbuilddir or undefined if not found.
     */

    locate(options) {
        if (!options.platform.match(/^win/)) return 'xbuild';
        let msbuildRoot;
        const is64Bit = options.architecture === 'x64';
        // On 64-bit systems msbuild is always under the x86 directory. If this
        // doesn't exist we are on a 32-bit system. See also:
        // https://blogs.msdn.microsoft.com/visualstudio/2013/07/24/msbuild-is-now-part-of-visual-studio/
        let pathRoot;
        if (is64Bit) {
            pathRoot = process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)';
        } else {
            pathRoot = process.env['ProgramFiles'] || 'C:/Program Files';
        }
        if (options.toolsVersion === 'auto') {
            const result = this.autoDetectVersion(pathRoot);
            msbuildRoot = result[0]
            options.toolsVersion = result[1];
        } else {
            if (options.toolsVersion < 1) {
                throw new Error(`Invalid MSBuild version was supplied: ${options.toolsVersion}`);
            }
            const matched = this.autoDetectVersion(pathRoot, options.toolsVersion);
            if (matched.length) {
                msbuildRoot = matched[0];
                toolsVersion = parseFloat(matched[1]);
                options.toolsVersion = toolsVersion;
            } else if (options.toolsVersion <= 4.0) {
                // try find in windir
                return this.findWindirMsBuildFor(is64Bit, options.toolsVersion);
            } else {
                // fall back on msbuild 15
                const msbuildDir = this.detectMsBuild15Dir(pathRoot);
                if (msbuildDir && options.toolsVersion >= 15.0) {
                    msbuildRoot = msbuildDir;
                } else {
                    msbuildRoot = pathRoot;
                }
            }
        }

        const version = this.constants.MSBUILD_VERSIONS[options.toolsVersion];
        if (!version) {
            if (this.options.onError) this.options.onError({
                type: 'error',
                msg: this.constants.PLUGIN_NAME + 'No MSBuild Version was supplied!'
            });
        }
        if (version >= 16) {
            if (is64Bit) {
                return path.join(msbuildRoot, "MSBuild", "Current", "Bin", "amd64", "MSBuild.exe");
            } else {
                return path.join(msbuildRoot, "MSBuild", "Current", "Bin", "MSBuild.exe");
            }
        } else if (version > 15 && version < 16) {
            let x64_dir = is64Bit ? "amd64" : "";
            const msbuildHome = path.join(msbuildRoot, "MSBuild");
            const msbuildExe = this.findMSBuildExeUnder(msbuildHome)
                .filter(exe => {
                    const pathParts = exe.split(path.sep);
                    return is64Bit ?
                        pathParts.indexOf(x64_dir) > -1 :
                        pathParts.indexOf(x64_dir) === -1;
                })[0];
            if (!msbuildExe) {
                throw new Error(`Unable to find msbuild.exe under ${msbuildHome}: ${options.toolsVersion}`);
            }
            return msbuildExe;
        } else if (version >= 12 && version <= 15) {
            let x64_dir = is64Bit ? "amd64" : "";
            return path.join(msbuildRoot, "MSBuild", version, "Bin", x64_dir, "MSBuild.exe");
        }

        const framework = is64Bit ? "Framework64" : "Framework";
        return path.join(options.windir, "Microsoft.Net", framework, version, "MSBuild.exe");
    }
}