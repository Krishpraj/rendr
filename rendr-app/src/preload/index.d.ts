import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      exportFile: (data: string, defaultName: string, filters: { name: string; extensions: string[] }[]) => Promise<string | null>
    }
  }
}
