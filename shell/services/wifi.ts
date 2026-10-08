// Wi-Fi: the network list is live from AstalNetwork; connecting goes through nmcli
// (works with every libastal version, including ones without AccessPoint.activate).
import { execAsync } from "ags/process"
import { parseSavedWifi } from "../lib/net"

let saved = new Set<string>()

export async function refreshSaved() {
  try {
    saved = parseSavedWifi(await execAsync(["nmcli", "-t", "-f", "NAME,TYPE", "connection", "show"]))
  } catch (e) {
    print(`ypsilon wifi: ${e}`)
  }
}

export const isSaved = (ssid: string) => saved.has(ssid)

/** false = a password is needed and none was given */
export async function connectWifi(ssid: string, secure: boolean, password?: string): Promise<boolean> {
  if (isSaved(ssid)) {
    await execAsync(["nmcli", "connection", "up", "id", ssid]).catch((e) => print(`ypsilon wifi: ${e}`))
  } else if (secure && !password) {
    return false
  } else {
    await execAsync(["nmcli", "dev", "wifi", "connect", ssid, ...(password ? ["password", password] : [])]).catch((e) =>
      print(`ypsilon wifi: ${e}`),
    )
  }
  refreshSaved()
  return true
}

export const disconnectWifi = () =>
  execAsync(["bash", "-c", "nmcli -t -f DEVICE,TYPE dev | awk -F: '$2==\"wifi\"{print $1; exit}' | xargs -r nmcli dev disconnect"])
    .catch((e) => print(`ypsilon wifi: ${e}`))
