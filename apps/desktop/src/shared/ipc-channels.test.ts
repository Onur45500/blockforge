import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALLOWED_EVENT_CHANNELS,
  ALLOWED_INVOKE_CHANNELS,
  isAllowedEventChannel,
  isAllowedInvokeChannel,
} from "./ipc-channels.js";
import { IPC } from "./ipc-types.js";

describe("IPC channel allowlists", () => {
  it("includes project create/list channels", () => {
    assert.ok(isAllowedInvokeChannel(IPC.PROJECT_CREATE));
    assert.ok(isAllowedInvokeChannel(IPC.PROJECT_LIST));
    assert.ok(ALLOWED_INVOKE_CHANNELS.includes(IPC.PROJECT_OPEN));
  });

  it("includes doctor bridge install channel", () => {
    assert.ok(isAllowedInvokeChannel(IPC.DOCTOR_INSTALL_BRIDGE_PLUGIN));
    assert.ok(ALLOWED_INVOKE_CHANNELS.includes(IPC.DOCTOR_RUN));
  });

  it("includes publish and asset channels", () => {
    assert.ok(isAllowedInvokeChannel(IPC.PUBLISH_PLACE));
    assert.ok(isAllowedInvokeChannel(IPC.ASSET_CATALOG));
    assert.ok(isAllowedInvokeChannel(IPC.ASSET_IMPORT));
    assert.ok(isAllowedInvokeChannel(IPC.ASSET_PREVIEW));
    assert.ok(isAllowedInvokeChannel(IPC.CLIPBOARD_READ));
    assert.ok(isAllowedInvokeChannel(IPC.CLIPBOARD_WRITE));
    assert.ok(isAllowedInvokeChannel(IPC.ROJO_STOP));
    assert.ok(isAllowedInvokeChannel(IPC.ROJO_START));
    assert.ok(isAllowedInvokeChannel(IPC.ROJO_RESTART));
  });

  it("includes pty list and style pack channels", () => {
    assert.ok(isAllowedInvokeChannel(IPC.PTY_LIST));
    assert.ok(isAllowedInvokeChannel(IPC.STYLE_PACK_ACTIVATE));
    assert.ok(isAllowedInvokeChannel(IPC.UPDATE_DOWNLOAD_INSTALL));
    assert.ok(isAllowedInvokeChannel(IPC.APP_INFO));
  });

  it("includes pty event channels", () => {
    assert.ok(isAllowedEventChannel(IPC.PTY_DATA));
    assert.ok(isAllowedEventChannel(IPC.PTY_EXIT));
    assert.ok(isAllowedEventChannel(IPC.PTY_STATUS_CHANGED));
    assert.ok(isAllowedEventChannel(IPC.APP_TOAST));
    assert.ok(isAllowedEventChannel(IPC.PROJECT_CREATE_PROGRESS));
    assert.ok(ALLOWED_EVENT_CHANNELS.includes(IPC.ROJO_STATUS_CHANGED));
  });

  it("includes git and backup invoke channels", () => {
    assert.ok(isAllowedInvokeChannel(IPC.GIT_STATUS));
    assert.ok(isAllowedInvokeChannel(IPC.BACKUP_CREATE));
    assert.ok(isAllowedInvokeChannel(IPC.STUDIO_LOCKS_STATUS));
  });

  it("rejects unknown channels", () => {
    assert.equal(isAllowedInvokeChannel("evil:channel"), false);
    assert.equal(isAllowedEventChannel("evil:event"), false);
  });
});
