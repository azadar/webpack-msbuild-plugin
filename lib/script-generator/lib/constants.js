'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _uuid = require('uuid');

var _path = require('path');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = {
  PLUGIN_NAME: 'webpack-msbuild',
  MSBUILD_VERSIONS: {
    1.0: 'v1.0.3705',
    1.1: 'v1.1.4322',
    2.0: 'v2.0.50727',
    3.5: 'v3.5',
    4.0: 'v4.0.30319',
    12.0: '12.0',
    14.0: '14.0',
    15.0: '15.0',
    16.0: '16.0',
    17.0: '17.0'
  },
  DEFAULTS: {
    stdout: false,
    stderr: true,
    errorOnFail: false,
    logCommand: false,
    targets: ["Rebuild"],
    configuration: "Release",
    toolsVersion: 4.0,
    properties: {},
    verbosity: "normal",
    maxcpucount: 0,
    nologo: true,
    platform: process.platform,
    architecture: detectArchitecture(),
    windir: process.env.WINDIR,
    msbuildPath: "",
    fileLoggerParameters: undefined,
    consoleLoggerParameters: undefined,
    loggerParameters: undefined,
    nodeReuse: true,
    customArgs: [],
    emitEndEvent: false,
    solutionPlatform: null,
    emitPublishedFiles: false,
    deployDefaultTarget: "WebPublish",
    webPublishMethod: "FileSystem",
    deleteExistingFiles: "true",
    findDependencies: "true",
    publishDirectory: (0, _path.join)(_os2.default.tmpdir(), (0, _uuid.v4)())
  }
};


function detectArchitecture() {
  if (process.platform.match(/^win/)) {
    return process.env.hasOwnProperty("ProgramFiles(x86)") ? "x64" : "x86";
  }

  return _os2.default.arch();
}