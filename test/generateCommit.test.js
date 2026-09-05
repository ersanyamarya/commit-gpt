"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const sinon = require("sinon");
const vscode = require("vscode");
const generateCommit_1 = require("../src/generateCommit");
// Mock the vscode module
const mockWindow = {
    showWarningMessage: sinon.fake(),
    showErrorMessage: sinon.fake(),
    showInformationMessage: sinon.fake(),
    withProgress: sinon.fake(),
    env: {
        clipboard: {
            writeText: sinon.fake.resolves()
        }
    }
};
const mockWorkspace = {
    workspaceFolders: [{
            uri: {
                fsPath: '/fake/workspace'
            }
        }],
    getConfiguration: sinon.fake.returns({
        get: sinon.fake.returns(undefined)
    })
};
const mockExtensions = {
    getExtension: sinon.fake.returns({
        exports: {
            getAPI: sinon.fake.returns({
                repositories: [{
                        inputBox: {
                            value: ''
                        }
                    }]
            })
        }
    })
};
const mockLm = {
    selectChatModels: sinon.fake.resolves([{
            sendRequest: sinon.fake.returns({
                text: sinon.fake.returnsAsync({
                    [Symbol.asyncIterator]: function* () {
                        yield 'feat(test): test commit message';
                        return;
                    }
                })
            })
        }])
};
describe('generateCommit', function () {
    let sandbox;
    beforeEach(function () {
        sandbox = sinon.createSandbox();
        // Stub vscode module
        sandbox.stub(vscode, 'window').get(() => mockWindow);
        sandbox.stub(vscode, 'workspace').get(() => mockWorkspace);
        sandbox.stub(vscode, 'extensions').get(() => mockExtensions);
        sandbox.stub(vscode, 'lm').get(() => mockLm);
        // Stub child_process
        sandbox.stub(require('child_process'), 'exec');
    });
    afterEach(function () {
        sandbox.restore();
    });
    it('should show warning when no workspace folders', async function () {
        mockWorkspace.workspaceFolders = undefined;
        await (0, generateCommit_1.generateCommit)();
        assert(mockWindow.showWarningMessage.calledWith('No workspace open'));
    });
    it('should show warning when workspace folder has no uri', async function () {
        mockWorkspace.workspaceFolders = [{ uri: undefined }];
        await (0, generateCommit_1.generateCommit)();
        assert(mockWindow.showWarningMessage.calledWith('No workspace open'));
    });
    it('should show warning when no files changed', async function () {
        // Mock execShell to return just newline (no files changed)
        const execShellStub = sandbox.stub(require('child_process'), 'exec')
            .onFirstCall().callsFake((cmd, callback) => {
            callback(null, '\n'); // No files changed
        })
            .onSecondCall().callsFake((cmd, callback) => {
            callback(null, ''); // Empty changes
        });
        await (0, generateCommit_1.generateCommit)();
        assert(mockWindow.showWarningMessage.calledWith('No files changed, stage your changes and try again'));
    });
    it('should generate commit message when files changed', async function () {
        // Mock execShell calls
        const execShellStub = sandbox.stub(require('child_process'), 'exec')
            .onFirstCall().callsFake((cmd, callback) => {
            callback(null, 'test-file.ts\n'); // Files changed
        })
            .onSecondCall().callsFake((cmd, callback) => {
            callback(null, '- test-file.ts:\n+ added feature'); // Git diff
        });
        await (0, generateCommit_1.generateCommit)();
        // Verify that withProgress was called
        assert(mockWindow.withProgress.calledOnce);
        // Verify that clipboard writeText was called with prompt
        assert(mockWindow.env.clipboard.writeText.calledOnce);
        // Verify that inputBox value was set
        assert.strictEqual(mockExtensions.getExtension().exports.getAPI().repositories[0].inputBox.value, 'feat(test): test commit message');
    });
});
//# sourceMappingURL=generateCommit.test.js.map