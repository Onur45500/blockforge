import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("spikeTerminal", {
  start: () => ipcRenderer.invoke("pty:start"),
  stop: () => ipcRenderer.invoke("pty:stop"),
  write: (data: string) => ipcRenderer.send("pty:input", data),
  resize: (cols: number, rows: number) =>
    ipcRenderer.send("pty:resize", { cols, rows }),
  onData: (cb: (data: string) => void) => {
    const listener = (_: unknown, data: string) => cb(data);
    ipcRenderer.on("pty:data", listener);
    return () => ipcRenderer.removeListener("pty:data", listener);
  },
  onExit: (cb: (msg: string) => void) => {
    const listener = (_: unknown, msg: string) => cb(msg);
    ipcRenderer.on("pty:exit", listener);
    return () => ipcRenderer.removeListener("pty:exit", listener);
  },
});
