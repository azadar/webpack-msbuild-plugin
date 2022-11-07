'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _deepExtend = require('deep-extend');

var _deepExtend2 = _interopRequireDefault(_deepExtend);

var _child_process = require('child_process');

var child = _interopRequireWildcard(_child_process);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Locator = function () {
    function Locator(options, DEFAULTS) {
        _classCallCheck(this, Locator);

        // upadte all parent classes with the options inherited
        this.options = (0, _deepExtend2.default)(DEFAULTS, options);
        this.lsCache = {};
    }

    _createClass(Locator, [{
        key: 'msBuildFromWhere',
        value: function msBuildFromWhere(pathRoot, findAll) {
            findAll = findAll || false;
            var vsWherePath = _path2.default.join(pathRoot, "Microsoft Visual Studio", "Installer", "vswhere.exe");
            if (!_fs2.default.existsSync(vsWherePath)) {
                // no vswhere -- fall back on manual methods
                return [];
            }
            var args = findAll ? [] : ["-latest"];
            args = args.concat(["-products", "*", "-requires", "Microsoft.Component.MSBuild"]);
            var whereProcess = child.spawnSync(vsWherePath, args, {
                cwd: process.cwd(),
                env: process.env,
                stdio: "pipe",
                encoding: "utf-8"
            });

            if (whereProcess.output === null) {
                return [];
            }
            var cmdOutput = "";
            if (whereProcess.output.length > 0) {
                for (var index = 0; index < whereProcess.output.length; index++) {
                    cmdOutput = whereProcess.output[index] || "";
                    if (cmdOutput.length > 0) {
                        break;
                    }
                }
            }
            var installKeyword = "installationPath";
            var installationVersionKeyword = "installationVersion";
            var all = [];
            if (cmdOutput.length > 0) {
                var installationPath = void 0,
                    installationVersion = void 0;

                var results = cmdOutput.split(/\r?\n/);
                for (var cmdLineIndex = 0; cmdLineIndex < results.length; cmdLineIndex++) {
                    var cmdLine = results[cmdLineIndex];
                    if (cmdLine.startsWith(installKeyword)) {
                        installationPath = cmdLine.replace(installKeyword + ": ", "");
                    }

                    if (cmdLine.startsWith(installationVersionKeyword)) {
                        var versionParts = cmdLine.replace(installationVersionKeyword + ": ", "").split(".");
                        if (versionParts.length > 0) {
                            installationVersion = parseFloat(versionParts[0]);
                        }
                    }
                    if (installationPath && installationVersion) {
                        all.push({
                            installationPath: installationPath,
                            installationVersion: installationVersion
                        });
                        installationPath = undefined;
                        installationVersion = undefined;
                    }
                }
            }

            all.sort(function (a, b) {
                return a.installationVersion - b.installationVersion;
            });
            if (findAll) {
                return all.map(function (o) {
                    return [o.installationPath, o.installationVersion];
                });
            } else {
                var highest = all[all.length - 1];
                if (highest === undefined) {
                    return [];
                }
                return [highest.installationPath, highest.installationVersion];
            }
        }
    }, {
        key: 'findWindirMsBuildFor',
        value: function findWindirMsBuildFor(is64Bit, toolsVersion, windir) {
            windir = windir || process.env.WINDIR;
            if (!windir) {
                return []; // can't look when we don't know where
            }
            var framework = is64Bit ? "Framework64" : "Framework";
            var baseDir = _path2.default.join(windir, "Microsoft.NET", framework);
            var frameworkVersions = _fs2.default.readdirSync(baseDir).filter(function (p) {
                return isDir(_path2.default.join(baseDir, p));
            }).map(function (p) {
                return p.replace(/^v/, "");
            }) // strip leading 'v'
            .map(function (p) {
                return parseFloat(p);
            }).filter(function (version) {
                return !isNaN(version);
            });
            var match = frameworkVersions.find(function (ver) {
                return ver.toFixed(1) === toolsVersion.toFixed(1);
            });
            if (!match) {
                throw new Error('No or invalid MSBuild version was supplied! (Can\'t find msbuild for toolsVersion under ' + baseDir + ' (perhaps override windir?))');
            }
            return _path2.default.join(baseDir, 'v' + match, "MSBuild.exe");
        }

        /**
         * @function
         * @name detectMsBuild15Dir
         * @description - Will try to find the 2017 visual studio path.
         * @param {[String]} [pathRoot] The root directory fir visual studio.
         * @returns {[String]} A path containing the msbuilddir or undefined if not found.
         */

    }, {
        key: 'detectMsBuild15Dir',
        value: function detectMsBuild15Dir(pathRoot) {
            var vs2017Path = _path2.default.join(pathRoot, 'Microsoft Visual Studio', '2017'),
                possibleFolders = ['BuildTools', 'Enterprise', 'Professional', 'Community'];
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                for (var _iterator = possibleFolders[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    var possibleFolder = _step.value;

                    try {
                        var folderPath = _path2.default.join(vs2017Path, possibleFolder);
                        _fs2.default.statSync(folderPath);
                        return folderPath;
                    } catch (e) {}
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion && _iterator.return) {
                        _iterator.return();
                    }
                } finally {
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }
        }
    }, {
        key: 'addDetectedMsBuildVersionsToConstantsLookup',
        value: function addDetectedMsBuildVersionsToConstantsLookup(executables) {
            var _this = this;

            return executables.map(function (exe) {
                try {
                    var proc = child.spawnSync(exe, ["/version"], {
                        encoding: "utf8"
                    });
                    var lines = proc.stdout.split(os.EOL);
                    var thisVersion = lines[lines.length - 1];
                    var verParts = thisVersion.split(".");
                    var major = verParts[0];
                    var shortVer = major + '.0'; // not technically correct: I see msbuild 16.1 on my machine, but keeps in line with prior versioning
                    var ver = parseFloat(shortVer);
                    if (!_this.constants.MSBUILD_VERSIONS[shortVer]) {
                        _this.constants.MSBUILD_VERSIONS[ver] = shortVer;
                        return ver;
                    }
                } catch (e) {
                    console.warn('Unable to query version of ' + exe + ': ' + e);
                }
            }).filter(function (ver) {
                return !!ver;
            }).reduce(function (acc, cur) {
                if (acc.indexOf(cur) === -1) {
                    acc.push(cur);
                }
                return acc;
            }, []).sort().reverse();
        }

        /**
         * @function
         * @name autoDetectVersion
         * @description - Will attempt to find the visual studio exe location.
         * @param {[String]} [pathRoot] The root directory for visual studio.
         * @returns {[String]} A path containing the msbuilddir or undefined if not found.
         */

    }, {
        key: 'autoDetectVersion',
        value: function autoDetectVersion(pathRoot, matchVersion) {
            // Try to detect using fromWhere
            var findAll = matchVersion !== undefined;
            var wherePath = this.msBuildFromWhere(pathRoot, findAll);
            if (wherePath.length > 0) {
                if (findAll) {
                    var _iteratorNormalCompletion2 = true;
                    var _didIteratorError2 = false;
                    var _iteratorError2 = undefined;

                    try {
                        for (var _iterator2 = wherePath[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                            var pair = _step2.value;

                            var _pair = _slicedToArray(pair, 2),
                                _ = _pair[0],
                                version = _pair[1];

                            if (version === matchVersion) {
                                return pair;
                            }
                        }
                    } catch (err) {
                        _didIteratorError2 = true;
                        _iteratorError2 = err;
                    } finally {
                        try {
                            if (!_iteratorNormalCompletion2 && _iterator2.return) {
                                _iterator2.return();
                            }
                        } finally {
                            if (_didIteratorError2) {
                                throw _iteratorError2;
                            }
                        }
                    }
                } else {
                    return wherePath;
                }
            }

            if (matchVersion >= 15.0) {
                // Try to detect MSBuild 15.0.
                var msbuild15OrLaterDir = detectMsBuild15Dir(pathRoot);
                if (msbuild15OrLaterDir) {
                    var msbuildHome = _path2.default.join(msbuild15OrLaterDir, "MSBuild");
                    var msbuildExecutables = this.findMSBuildExeUnder(msbuildHome);
                    var detected = this.addDetectedMsBuildVersionsToConstantsLookup(msbuildExecutables);
                    return [msbuild15OrLaterDir, detected[0] || 15.0];
                }
            }

            // Detect MSBuild lower than 15.0.
            // ported from https://github.com/stevewillcock/grunt-msbuild/blob/master/tasks/msbuild.js#L167-L181
            var msbuildDir = _path2.default.join(pathRoot, 'MSBuild');
            var msbuildDirExists = true;
            try {
                _fs2.default.statSync(msbuildDir);
            } catch (e) {
                msbuildDirExists = false;
            }
            if (!msbuildDirExists) return [pathRoot, 4.0];
            var msbuildVersions = _fs2.default.readdirSync(msbuildDir).filter(function (entryName) {
                var binDirExists = true;
                var binDirPath = _path2.default.join(msbuildDir, entryName, 'Bin');
                try {
                    _fs2.default.statSync(binDirPath);
                } catch (e) {
                    binDirExists = false;
                }
                return entryName.indexOf('1') === 0 && binDirExists;
            });
            // Return latest installed msbuild version
            if (msbuildVersions.length > 0) return [pathRoot, parseFloat(msbuildVersions.pop())];
        }
    }, {
        key: 'lsR',
        value: function (_lsR) {
            function lsR(_x) {
                return _lsR.apply(this, arguments);
            }

            lsR.toString = function () {
                return _lsR.toString();
            };

            return lsR;
        }(function (folder) {
            if (lsCache[folder]) {
                return lsCache[folder];
            }
            return lsCache[folder] = _fs2.default.readdirSync(folder).reduce(function (acc, cur) {
                var fullPath = _path2.default.join(folder, cur);
                var st = _fs2.default.statSync(fullPath);
                if (st.isFile()) {
                    acc.push(fullPath);
                    return acc;
                }
                return acc.concat(lsR(fullPath));
            }, []);
        })
    }, {
        key: 'findMSBuildExeUnder',
        value: function findMSBuildExeUnder(folder) {
            return lsR(folder).filter(function (fpath) {
                var fileName = _path2.default.basename(fpath);
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

    }, {
        key: 'locate',
        value: function locate(options) {
            if (!options.platform.match(/^win/)) return 'xbuild';
            var msbuildRoot = void 0;
            var is64Bit = options.architecture === 'x64';
            // On 64-bit systems msbuild is always under the x86 directory. If this
            // doesn't exist we are on a 32-bit system. See also:
            // https://blogs.msdn.microsoft.com/visualstudio/2013/07/24/msbuild-is-now-part-of-visual-studio/
            var pathRoot = void 0;
            if (is64Bit) {
                pathRoot = process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)';
            } else {
                pathRoot = process.env['ProgramFiles'] || 'C:/Program Files';
            }
            if (options.toolsVersion === 'auto') {
                var result = this.autoDetectVersion(pathRoot);
                msbuildRoot = result[0];
                options.toolsVersion = result[1];
            } else {
                if (options.toolsVersion < 1) {
                    throw new Error('Invalid MSBuild version was supplied: ' + options.toolsVersion);
                }
                var matched = this.autoDetectVersion(pathRoot, options.toolsVersion);
                if (matched.length) {
                    msbuildRoot = matched[0];
                    toolsVersion = parseFloat(matched[1]);
                    options.toolsVersion = toolsVersion;
                } else if (options.toolsVersion <= 4.0) {
                    // try find in windir
                    return this.findWindirMsBuildFor(is64Bit, options.toolsVersion);
                } else {
                    // fall back on msbuild 15
                    var msbuildDir = this.detectMsBuild15Dir(pathRoot);
                    if (msbuildDir && options.toolsVersion >= 15.0) {
                        msbuildRoot = msbuildDir;
                    } else {
                        msbuildRoot = pathRoot;
                    }
                }
            }

            var version = this.constants.MSBUILD_VERSIONS[options.toolsVersion];
            if (!version) {
                if (this.options.onError) this.options.onError({
                    type: 'error',
                    msg: this.constants.PLUGIN_NAME + 'No MSBuild Version was supplied!'
                });
            }
            if (version >= 16) {
                if (is64Bit) {
                    return _path2.default.join(msbuildRoot, "MSBuild", "Current", "Bin", "amd64", "MSBuild.exe");
                } else {
                    return _path2.default.join(msbuildRoot, "MSBuild", "Current", "Bin", "MSBuild.exe");
                }
            } else if (version > 15 && version < 16) {
                var x64_dir = is64Bit ? "amd64" : "";
                var msbuildHome = _path2.default.join(msbuildRoot, "MSBuild");
                var msbuildExe = this.findMSBuildExeUnder(msbuildHome).filter(function (exe) {
                    var pathParts = exe.split(_path2.default.sep);
                    return is64Bit ? pathParts.indexOf(x64_dir) > -1 : pathParts.indexOf(x64_dir) === -1;
                })[0];
                if (!msbuildExe) {
                    throw new Error('Unable to find msbuild.exe under ' + msbuildHome + ': ' + options.toolsVersion);
                }
                return msbuildExe;
            } else if (version >= 12 && version <= 15) {
                var _x64_dir = is64Bit ? "amd64" : "";
                return _path2.default.join(msbuildRoot, "MSBuild", version, "Bin", _x64_dir, "MSBuild.exe");
            }

            var framework = is64Bit ? "Framework64" : "Framework";
            return _path2.default.join(options.windir, "Microsoft.Net", framework, version, "MSBuild.exe");
        }
    }]);

    return Locator;
}();

exports.default = Locator;