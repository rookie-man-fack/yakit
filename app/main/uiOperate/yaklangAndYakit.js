const {ipcMain, app} = require("electron")
const fs = require("fs")
const https = require("https")
const {getLocalYaklangEngine} = require("../filePath")
const {fetchLatestYakEngineVersion} = require("../handlers/utils/network");

module.exports = (win, getClient) => {
    /** yaklang引擎是否安装 */
    ipcMain.handle("is-yaklang-engine-installed", () => {
        /** @returns {Boolean} */
        return fs.existsSync(getLocalYaklangEngine())
    })

    /** 获取Yaklang引擎最新版本号 */
    const asyncFetchLatestYaklangVersion = () => {
        return new Promise((resolve, reject) => {
            fetchLatestYakEngineVersion().then(version => {
                resolve(`${version}`.trim())
            }).catch(err => {
                reject(err)
            })
        })
    }
    /** 获取Yaklang引擎最新版本号 */
    ipcMain.handle("fetch-latest-yaklang-version", async (e) => {
        return await asyncFetchLatestYaklangVersion()
    })

    /** 获取Yakit最新版本号 */
    const asyncFetchLatestYakitVersion = () => {
        return new Promise((resolve, reject) => {
            let rsp = https.get("https://yaklang.oss-cn-beijing.aliyuncs.com/yak/latest/yakit-version.txt")
            rsp.on("response", (rsp) => {
                rsp.on("data", (data) => {
                    resolve(`v${Buffer.from(data).toString("utf8")}`.trim())
                }).on("error", (err) => reject(err))
            })
            rsp.on("error", reject)
        })
    }
    /** 获取Yakit最新版本号 */
    ipcMain.handle("fetch-latest-yakit-version", async (e) => {
        return await asyncFetchLatestYakitVersion()
    })

    /** 获取Yakit本地版本号 */
    ipcMain.handle("fetch-yakit-version", async (e) => {
        return app.getVersion()
    })

    /** 以更新引擎但未关闭内存中的老版本引擎进程(mac) */
    ipcMain.handle("kill-old-engine-process", (e, type) => {
        win.webContents.send("kill-old-engine-process-callback", type)
    })
}
